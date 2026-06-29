using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Game.UI.Localization;
using HallOfFame.Http;
using HallOfFame.Logging;
using HallOfFame.Reflection;
using HallOfFame.Utils;

namespace HallOfFame.Services;

/// <summary>
/// Owns the creator identity lifecycle lifted out of <see cref="Settings"/>: the Creator ID
/// bootstrap on mod load, the login sync that talks to the server and drives the Options-panel
/// status text, and the assembly of the per-request authorization credential.
/// <para>
/// The module reaches the persisted, UI-bound identity state through the narrow
/// <see cref="ICreatorIdentityStore"/> seam (implemented by <see cref="Settings"/>, onto which the
/// framework deserializes the state before this module exists), and touches the Paradox login
/// through the <see cref="IParadoxConnection"/> seam.
/// Both seams keep this class free of engine and reflection calls, so it constructs and runs
/// off-engine under test.
/// </para>
/// <para>
/// Scheduling a sync is owned here too: it cancels a superseded call, debounces rapid triggers
/// (typing in the Creator Name field), picks the right server call, and writes the resulting status
/// text back to the store.
/// The <see cref="Settings"/> shell only forwards UI events here.
/// </para>
/// </summary>
/// <param name="api">
/// Server API used to fetch (<c>GetMe</c>) or push (<c>UpdateMe</c>) the creator info.
/// </param>
/// <param name="log">Mod logger.</param>
/// <param name="store">
/// Narrow seam over the persisted, UI-bound identity state on <see cref="Settings"/>.
/// </param>
/// <param name="hwid">
/// Stable hardware identifier included in the authorization credential, read once from the engine
/// in the composition root.
/// </param>
/// <param name="paradox">
/// Seam over the Paradox login touchpoint: the account-ID read and the no-connection warning
/// dialog.
/// </param>
internal sealed class CreatorIdentity(
  IHallOfFameApi api,
  IModLog log,
  ICreatorIdentityStore store,
  string hwid,
  IParadoxConnection paradox
) {
  /// <summary>
  /// Cancellation source for the in-flight sync, letting a newer <see cref="Sync"/> supersede the
  /// previous one (canceling its debounce delay and/or network call).
  /// </summary>
  private CancellationTokenSource? syncCts;

  /// <summary>
  /// Last Creator Name seen by <see cref="OnSettingsApplied"/>, used to tell a name edit apart from
  /// any other settings change.
  /// Seeded by <see cref="Start"/> and advanced on each applied event.
  /// </summary>
  private string? previousCreatorName;

  /// <summary>
  /// Bootstraps the identity, then starts the first login sync, in that order.
  /// The composition root must have set <see cref="Mod.CreatorIdentity"/> before calling this,
  /// since the startup sync issues the first authorized request, which assembles its credential
  /// through that static.
  /// </summary>
  internal void Start() {
    this.Bootstrap();

    // Sync the account with the server on mod load.
    this.Sync(CreatorSyncTrigger.Startup);

    // Seed the name baseline so the first applied-settings event diffs against the loaded value.
    this.previousCreatorName = store.CreatorName;
  }

  /// <summary>
  /// Bootstraps <see cref="ICreatorIdentityStore.CreatorID"/> and
  /// <see cref="ICreatorIdentityStore.IsParadoxAccountID"/> from the Paradox account ID, or a
  /// locally generated fallback when the user is not logged in or the read fails, saving only when
  /// the resolved ID actually changed.
  /// The warning dialog is shown only for a clean "not logged in" read, not for a thrown read
  /// error, which falls silently through to the random fallback (aside from the warning log).
  /// </summary>
  internal void Bootstrap() {
    // Read and store the Paradox account ID.
    // Why store it?
    // 1. If the user once plays without an internet connection or server failure, we'll still have
    //    the ID used previously.
    // 2. If for some reason the user changes the Paradox account they use, it doesn't mean they
    //    want to change their Hall of Fame account, so we keep the old ID.
    // 3. It is more explicit and transparent to the user.
    //
    // A clean null (user not logged in to Paradox) and a thrown read error are kept distinct: only
    // a clean null pops the warning dialog below, while a thrown read falls silently through to the
    // random-ID fallback (aside from the warning log).
    string? paradoxAccountId;
    Exception? readError = null;

    try {
      paradoxAccountId = paradox.ReadAccountId();
    }
    catch (Exception ex) {
      paradoxAccountId = null;
      readError = ex;
    }

    var resolution = CreatorIdentity.ResolveCreatorId(store.CreatorID, paradoxAccountId);

    // A valid existing ID is left untouched, with no save.
    if (!resolution.Changed) {
      return;
    }

    store.CreatorID = resolution.CreatorId;
    store.IsParadoxAccountID = resolution.IsParadoxAccountId;

    if (resolution.IsParadoxAccountId) {
      log.Info($"{nameof(CreatorIdentity)}: Acquired Paradox account ID {store.MaskedCreatorID}.");
    }
    else {
      // The warning dialog is for users not logged in to Paradox (a clean null read), not for an
      // unexpected read failure, which only logs the warning below.
      if (resolution.NeedsParadoxWarning && readError is null) {
        paradox.ShowNoParadoxConnectionWarning();
      }

      log.Warn(
        readError ?? new Exception("User is not logged in to Paradox."),
        $"{nameof(CreatorIdentity)}: Could not acquire Paradox account ID, using a " +
        $"random ID as a fallback ({store.MaskedCreatorID})."
      );
    }

    // Explicitly save the settings so they're written to disk asap.
    store.Save();
  }

  /// <summary>
  /// Pure bootstrap decision for the Creator ID, with no engine I/O, so it is unit-testable.
  /// The Paradox account-ID read and the no-connection warning live in <see cref="Bootstrap"/>
  /// behind the <see cref="IParadoxConnection"/> seam; this only chooses between keeping a valid
  /// existing ID, adopting the Paradox ID, or falling back to a fresh random one.
  /// </summary>
  /// <param name="existingId">
  /// The currently persisted Creator ID, if any; a valid <see cref="Guid"/> here is kept as is.
  /// </param>
  /// <param name="paradoxAccountId">
  /// The Paradox account ID read by the bootstrap, or <c>null</c> when unavailable (the user is not
  /// logged in, or the read failed).
  /// </param>
  internal static CreatorIdResolution ResolveCreatorId(
    string? existingId,
    string? paradoxAccountId
  ) {
    // A valid existing ID is permanent: keep everything and let the bootstrap skip saving.
    if (Guid.TryParse(existingId, out _)) {
      return new CreatorIdResolution(
        existingId!,
        IsParadoxAccountId: false,
        NeedsParadoxWarning: false,
        Changed: false
      );
    }

    if (paradoxAccountId is not null) {
      return new CreatorIdResolution(
        paradoxAccountId,
        IsParadoxAccountId: true,
        NeedsParadoxWarning: false,
        Changed: true
      );
    }

    // No usable Paradox ID: generate a random one and let the bootstrap warn the user.
    return new CreatorIdResolution(
      Guid.NewGuid().ToString(),
      IsParadoxAccountId: false,
      NeedsParadoxWarning: true,
      Changed: true
    );
  }

  /// <summary>
  /// Builds the value of the <c>Authorization</c> header carrying the creator credential: the
  /// URL-escaped Creator Name, the Creator ID, the provider (<c>paradox</c> or <c>local</c>), and
  /// the hardware ID.
  /// Consumed by the HTTP layer for every Hall of Fame API request.
  /// </summary>
  internal string BuildAuthorizationHeader() {
    var creatorName = store.CreatorName is null
      ? string.Empty
      : Uri.EscapeDataString(store.CreatorName);

    var provider = store.IsParadoxAccountID ? "paradox" : "local";

    return "Creator " +
           $"name={creatorName}" +
           $"&id={store.CreatorID}" +
           $"&provider={provider}" +
           $"&hwid={hwid}";
  }

  /// <summary>
  /// Handles an applied settings change by starting the matching sync: a Creator Name edit syncs
  /// the name and shows the result, any other change pushes the updated info silently.
  /// </summary>
  internal void OnSettingsApplied() {
    this.Sync(this.NextSyncTrigger());
  }

  /// <summary>
  /// Picks the sync trigger for the current applied-settings event by diffing the Creator Name
  /// against the previously seen value, then advances that baseline for the next event.
  /// Split out from <see cref="OnSettingsApplied"/> so the trigger selection and the name tracking
  /// stay unit-testable without the async-void <see cref="Sync"/> scheduling around them.
  /// </summary>
  internal CreatorSyncTrigger NextSyncTrigger() {
    var trigger = this.previousCreatorName != store.CreatorName
      ? CreatorSyncTrigger.NameEdited
      : CreatorSyncTrigger.OtherSettingChanged;

    this.previousCreatorName = store.CreatorName;

    return trigger;
  }

  /// <summary>
  /// Starts a creator sync for the given <paramref name="trigger"/> and reflects its progress in
  /// the Options UI by writing to the store's status sink.
  /// Fire-and-forget: it cancels any in-flight sync, debounces when the trigger calls for it, runs
  /// the server call, then writes the resulting status (unless the sync is silent).
  /// </summary>
  /// <param name="trigger">
  /// What initiated the sync; it alone decides the server call, whether the status is shown, and
  /// whether the call is debounced (see <see cref="PlanFor"/>).
  /// </param>
  // ReSharper disable once AsyncVoidMethod
  internal async void Sync(CreatorSyncTrigger trigger) {
    var plan = CreatorIdentity.PlanFor(trigger);

    // Cancel any in-flight sync; the latest trigger wins.
    this.syncCts?.Cancel();

    var thisCts = this.syncCts = new CancellationTokenSource();

    if (!plan.Silent) {
      // Show a loading message while the sync runs.
      store.LoginStatus = LocalizedString.Id("HallOfFame.Common.LOADING");
    }

    try {
      if (plan.Debounce) {
        // Debounce rapid triggers, e.g., keystrokes while typing the Creator Name.
        await Task.Delay(500, thisCts.Token);
      }

      var status = await this.RunSync(trigger, thisCts.Token);

      // A null status means there is nothing to display (a silent sync); leave the row as is.
      if (status is not null) {
        store.LoginStatus = status.Value;
      }
    }
    catch (OperationCanceledException) {
      // The debounce delay or the network call was superseded by a newer sync; leave status as is.
    }
    finally {
      // Clear the shared source only if no newer sync replaced it in the meantime.
      if (thisCts == this.syncCts) {
        this.syncCts = null;
      }
    }
  }

  /// <summary>
  /// Runs a single creator sync against the server and returns the resulting Options-panel status
  /// text, or <c>null</c> when there is nothing to display (a silent sync, or a silent error that
  /// is logged instead).
  /// This is the testable core of <see cref="Sync"/>, without the scheduling (cancel, debounce,
  /// store write) wrapped around it.
  /// </summary>
  /// <param name="trigger">
  /// Sync trigger, mapped to its <see cref="SyncPlan"/> by <see cref="PlanFor"/>.
  /// </param>
  /// <param name="ct">
  /// Token from <see cref="Sync"/>; a superseded call is observed and surfaced as
  /// <see cref="OperationCanceledException"/> for the caller to ignore.
  /// </param>
  internal async Task<LocalizedString?> RunSync(
    CreatorSyncTrigger trigger,
    CancellationToken ct
  ) {
    var plan = CreatorIdentity.PlanFor(trigger);

    try {
      // Both calls create/update the account from the auth header (which carries the Creator Name);
      // UpdateMe additionally pushes the locale and mod settings.
      var creator = plan.FullInfo
        ? await api.UpdateMe()
        : await api.GetMe();

      log.Info(
        $"{nameof(CreatorIdentity)}: Logged in as {creator.CreatorName}. " +
        $"Your Public Creator ID is {creator.Id}."
      );

      // Stop if the sync was superseded while fetching; the log above still fires, matching the
      // original ordering (a superseded call still logs).
      ct.ThrowIfCancellationRequested();

      if (plan.Silent) {
        return null;
      }

      var isAnonymous = string.IsNullOrEmpty(creator.CreatorName);

      return new LocalizedString(
        id: isAnonymous
          ? "Options.OPTION_VALUE[HallOfFame.HallOfFame.Mod.Settings.LoginStatus.LoggedInAnonymously]"
          : "Options.OPTION_VALUE[HallOfFame.HallOfFame.Mod.Settings.LoginStatus.LoggedInAs]",
        value: null,
        args: new Dictionary<string, ILocElement> {
          { "CREATOR_NAME", LocalizedString.Value(creator.CreatorName) }
        }
      );
    }
    // Let the caller ignore superseded calls; this must precede the generic catch so the latter
    // does not swallow the cancellation.
    catch (OperationCanceledException) {
      throw;
    }

    catch (Exception ex) {
      if (!plan.Silent) {
        // Surface a user-friendly error in the status row.
        return ex.GetUserFriendlyMessage();
      }

      log.ErrorSilent(ex, $"{nameof(CreatorIdentity)}: Failed to sync creator.");

      return null;
    }
  }

  /// <summary>
  /// Maps a <see cref="CreatorSyncTrigger"/> to how its sync runs.
  /// This is the single place the three scenarios diverge, keeping <see cref="Sync"/> and
  /// <see cref="RunSync"/> free of scattered flag logic.
  /// </summary>
  internal static SyncPlan PlanFor(CreatorSyncTrigger trigger) => trigger switch {
    // Mod load: push full info, show status, run immediately.
    CreatorSyncTrigger.Startup =>
      new SyncPlan(FullInfo: true, Silent: false, Debounce: false),

    // Creator Name edited: sync just the name (via GetMe), show status, debounce typing.
    CreatorSyncTrigger.NameEdited =>
      new SyncPlan(FullInfo: false, Silent: false, Debounce: true),

    // Any other setting changed: push full info (via UpdateMe), stay silent, debounce.
    CreatorSyncTrigger.OtherSettingChanged =>
      new SyncPlan(FullInfo: true, Silent: true, Debounce: true),
    _ => throw new ArgumentOutOfRangeException(nameof(trigger), trigger, null)
  };

  /// <summary>
  /// How a creator sync runs, derived from its <see cref="CreatorSyncTrigger"/> by
  /// <see cref="PlanFor"/>.
  /// </summary>
  /// <param name="FullInfo">
  /// Push the full payload via <c>UpdateMe</c> (locale and mod settings) instead of only syncing
  /// the name via <c>GetMe</c>.
  /// </param>
  /// <param name="Silent">
  /// Suppress the status text (loading, success, and error); a silent error is logged instead.
  /// Used for background syncs.
  /// </param>
  /// <param name="Debounce">
  /// Delay briefly before running to coalesce rapid triggers such as keystrokes.
  /// </param>
  internal readonly record struct SyncPlan(bool FullInfo, bool Silent, bool Debounce);
}

/// <summary>
/// What initiated a creator sync. The trigger alone determines how the sync runs (see
/// <see cref="CreatorIdentity.PlanFor"/>), so callers express intent instead of toggling
/// low-level flags.
/// </summary>
internal enum CreatorSyncTrigger {
  /// <summary>
  /// The mod is loading: ensure the account exists and push full info, showing the result.
  /// </summary>
  Startup,

  /// <summary>
  /// The user edited the Creator Name: sync the name with the server and show the result.
  /// </summary>
  NameEdited,

  /// <summary>
  /// Another setting changed: push the updated info to the server without disturbing the status row.
  /// </summary>
  OtherSettingChanged
}

/// <summary>
/// Outcome of <see cref="CreatorIdentity.ResolveCreatorId"/>: which Creator ID to use and what the
/// bootstrap should do with it.
/// </summary>
/// <param name="CreatorId">
/// The ID to use: the existing one (when unchanged), the Paradox account ID, or a freshly generated
/// random one.
/// </param>
/// <param name="IsParadoxAccountId">
/// Whether <paramref name="CreatorId"/> is the Paradox account ID rather than a random fallback.
/// </param>
/// <param name="NeedsParadoxWarning">
/// Whether the random fallback was chosen, hinting the bootstrap may need to warn the user; the
/// bootstrap still gates the actual dialog on whether the Paradox read returned a clean null.
/// </param>
/// <param name="Changed">
/// Whether the ID changed; when false, the bootstrap keeps the existing state and skips saving.
/// </param>
internal readonly record struct CreatorIdResolution(
  string CreatorId,
  bool IsParadoxAccountId,
  bool NeedsParadoxWarning,
  bool Changed
);
