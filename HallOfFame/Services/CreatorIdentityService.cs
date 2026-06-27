using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Colossal.Logging;
using Game.UI.Localization;
using HallOfFame.Http;
using HallOfFame.Utils;

namespace HallOfFame.Services;

/// <summary>
/// Holds the creator identity and login behavior lifted out of <see cref="Settings"/>: the pure
/// Creator ID bootstrap decision (<see cref="ResolveCreatorId"/>) and the login/refresh operation
/// that talks to the server and builds the Options-panel status text (<see cref="Refresh"/>).
/// The persisted and UI-bound identity state stays on <see cref="Settings"/>; this class owns only
/// the logic, which is what makes it unit-testable off-engine.
/// The scheduling (cancel the previous call, debounce typing) stays in the <see cref="Settings"/>
/// shell.
/// </summary>
internal sealed class CreatorIdentityService(IHallOfFameApi api, ILog log) {
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
  /// Checks and/or updates the account name with the server and returns the resulting Options-panel
  /// status text, or <c>null</c> when there is nothing to display.
  /// The caller (the <see cref="Settings"/> shell) owns scheduling: it cancels superseded calls and
  /// debounces typing, then assigns the returned status.
  /// </summary>
  /// <param name="nameOnly">
  /// If true, only fetch the name (<c>GetMe</c>); otherwise also push other info (<c>UpdateMe</c>).
  /// </param>
  /// <param name="silent">
  /// Whether to suppress the status text (loading, success, and error), used for background
  /// refreshes; a silent error is logged instead of being surfaced.
  /// </param>
  /// <param name="ct">
  /// Token from the shell; a superseded call is observed and surfaced as
  /// <see cref="OperationCanceledException"/> for the shell to ignore.
  /// </param>
  internal async Task<LocalizedString?> Refresh(
    bool nameOnly,
    bool silent,
    CancellationToken ct
  ) {
    try {
      // Fetch the creator info from the server; UpdateMe also pushes the local Creator Name if it
      // differs from the server's.
      var creator = nameOnly
        ? await api.GetMe()
        : await api.UpdateMe();

      // The "Settings:" prefix is kept verbatim from the original location so log output is
      // unchanged by the extraction.
      log.Info(
        $"{nameof(CreatorIdentityService)}: Logged in as {creator.CreatorName}. " +
        $"Your Public Creator ID is {creator.Id}."
      );

      // Stop if the operation was canceled while we were fetching data; the log above still fires,
      // matching the original ordering (a superseded call still logs).
      ct.ThrowIfCancellationRequested();

      if (silent) {
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

    // Let the shell ignore superseded calls; this must precede the generic catch so the latter does
    // not swallow the cancellation.
    catch (OperationCanceledException) {
      throw;
    }

    catch (Exception ex) {
      if (!silent) {
        // Surface a user-friendly error in the status row.
        return ex.GetUserFriendlyMessage();
      }

      log.ErrorSilent(ex, $"{nameof(CreatorIdentityService)}: Failed to update creator.");

      return null;
    }
  }
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
