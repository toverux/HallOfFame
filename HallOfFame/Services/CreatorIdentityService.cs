using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Game.UI.Localization;
using HallOfFame.Http;
using HallOfFame.Logging;
using HallOfFame.Utils;

namespace HallOfFame.Services;

/// <summary>
/// Owns the creator identity and login behavior lifted out of <see cref="Settings"/>: the pure
/// Creator ID bootstrap decision (<see cref="ResolveCreatorId"/>) and the full login sync that
/// talks to the server and drives the Options-panel status text.
/// <para>
/// This service owns the whole scheduling of a sync: it cancels a superseded call, debounces rapid
/// triggers (typing in the Creator Name field), picks the right server call, and pushes the
/// resulting status text back through <paramref name="onStatus"/>. The <see cref="Settings"/> shell
/// only forwards UI events to <see cref="Sync"/> and binds the status it receives.
/// </para>
/// <para>
/// The persisted and UI-bound identity state (Creator ID, Creator Name, the status field) stays on
/// <see cref="Settings"/>; this class owns only the logic, which is what makes it unit-testable
/// off-engine.
/// </para>
/// </summary>
/// <param name="api">
/// Server API used to fetch (<c>GetMe</c>) or push (<c>UpdateMe</c>) the creator info.
/// </param>
/// <param name="log">Mod logger.</param>
/// <param name="onStatus">
/// Sink for the Options-panel status text, invoked with the loading, success, or error string; the
/// shell assigns it to its UI-bound field. Not called for the silent part of a background sync.
/// </param>
internal sealed class CreatorIdentityService(
  IHallOfFameApi api,
  IModLog log,
  Action<LocalizedString> onStatus
) {
  /// <summary>
  /// Cancellation source for the in-flight sync, letting a newer <see cref="Sync"/> supersede the
  /// previous one (canceling its debounce delay and/or network call).
  /// </summary>
  private CancellationTokenSource? syncCts;

  /// <summary>
  /// Pure bootstrap decision for the Creator ID, with no engine I/O so it is unit-testable.
  /// The reflection read of the Paradox account ID and the no-Paradox-connection warning dialog
  /// stay in the <see cref="Settings"/> shell; this only chooses between keeping a valid existing
  /// ID, adopting the Paradox ID, or falling back to a fresh random one.
  /// </summary>
  /// <param name="existingId">
  /// The currently persisted Creator ID, if any; a valid <see cref="Guid"/> here is kept as is.
  /// </param>
  /// <param name="paradoxAccountId">
  /// The Paradox account ID read by the shell, or <c>null</c> when unavailable (the user is not
  /// logged in, or the read failed).
  /// </param>
  internal static CreatorIdResolution ResolveCreatorId(
    string? existingId,
    string? paradoxAccountId
  ) {
    // A valid existing ID is permanent: keep everything and let the shell skip saving.
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

    // No usable Paradox ID: generate a random one and let the shell warn the user.
    return new CreatorIdResolution(
      Guid.NewGuid().ToString(),
      IsParadoxAccountId: false,
      NeedsParadoxWarning: true,
      Changed: true
    );
  }

  /// <summary>
  /// Starts a creator sync for the given <paramref name="trigger"/> and reflects its progress in the
  /// Options UI through the status sink.
  /// Fire-and-forget: it cancels any in-flight sync, debounces when the trigger calls for it, runs
  /// the server call, then pushes the resulting status (unless the sync is silent).
  /// </summary>
  /// <param name="trigger">
  /// What initiated the sync; it alone decides the server call, whether the status is shown, and
  /// whether the call is debounced (see <see cref="PlanFor"/>).
  /// </param>
  // ReSharper disable once AsyncVoidMethod
  internal async void Sync(CreatorSyncTrigger trigger) {
    var plan = CreatorIdentityService.PlanFor(trigger);

    // Cancel any in-flight sync; the latest trigger wins.
    this.syncCts?.Cancel();

    var thisCts = this.syncCts = new CancellationTokenSource();

    if (!plan.Silent) {
      // Show a loading message while the sync runs.
      onStatus(LocalizedString.Id("HallOfFame.Common.LOADING"));
    }

    try {
      if (plan.Debounce) {
        // Debounce rapid triggers, e.g. keystrokes while typing the Creator Name.
        await Task.Delay(500, thisCts.Token);
      }

      var status = await this.RunSync(trigger, thisCts.Token);

      // A null status means there is nothing to display (a silent sync); leave the row as is.
      if (status is not null) {
        onStatus(status.Value);
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
  /// text, or <c>null</c> when there is nothing to display (a silent sync, or a silent error that is
  /// logged instead).
  /// This is the testable core of <see cref="Sync"/>, without the scheduling (cancel, debounce,
  /// status sink) wrapped around it.
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
    var plan = CreatorIdentityService.PlanFor(trigger);

    try {
      // Both calls create/update the account from the auth header (which carries the Creator Name);
      // UpdateMe additionally pushes the locale and mod settings.
      var creator = plan.FullInfo
        ? await api.UpdateMe()
        : await api.GetMe();

      log.Info(
        $"{nameof(CreatorIdentityService)}: Logged in as {creator.CreatorName}. " +
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

      log.ErrorSilent(ex, $"{nameof(CreatorIdentityService)}: Failed to sync creator.");

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
  /// Push the full payload via <c>UpdateMe</c> (locale and mod settings) instead of only syncing the
  /// name via <c>GetMe</c>.
  /// </param>
  /// <param name="Silent">
  /// Suppress the status text (loading, success, and error); a silent error is logged instead. Used
  /// for background syncs.
  /// </param>
  /// <param name="Debounce">
  /// Delay briefly before running to coalesce rapid triggers such as keystrokes.
  /// </param>
  internal readonly record struct SyncPlan(bool FullInfo, bool Silent, bool Debounce);
}

/// <summary>
/// What initiated a creator sync. The trigger alone determines how the sync runs (see
/// <see cref="CreatorIdentityService.PlanFor"/>), so callers express intent instead of toggling
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
/// Outcome of <see cref="CreatorIdentityService.ResolveCreatorId"/>: which Creator ID to use and
/// what the shell should do with it.
/// </summary>
/// <param name="CreatorId">
/// The ID to use: the existing one (when unchanged), the Paradox account ID, or a freshly generated
/// random one.
/// </param>
/// <param name="IsParadoxAccountId">
/// Whether <paramref name="CreatorId"/> is the Paradox account ID rather than a random fallback.
/// </param>
/// <param name="NeedsParadoxWarning">
/// Whether the random fallback was chosen, hinting the shell may need to warn the user; the shell
/// still gates the actual dialog on whether the Paradox read returned a clean null.
/// </param>
/// <param name="Changed">
/// Whether the ID changed; when false the shell keeps the existing state and skips saving.
/// </param>
internal readonly record struct CreatorIdResolution(
  string CreatorId,
  bool IsParadoxAccountId,
  bool NeedsParadoxWarning,
  bool Changed
);
