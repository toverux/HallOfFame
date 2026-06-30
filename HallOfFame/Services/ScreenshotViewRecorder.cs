using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HallOfFame.Http;
using HallOfFame.Logging;

namespace HallOfFame.Services;

/// <summary>
/// Records community screenshots as viewed against the server, as a fire-and-forget side effect of
/// navigation landing on a screenshot for the first time.
/// <para>
/// Owns session-level view dedupe: the weighted-random feed can serve the same screenshot again
/// later in a session (especially once it has been trimmed off the carousel's bounded window), so
/// this remembers the ids it has already recorded and counts each one at most once.
/// A recording that fails was never counted, so its id is dropped from the memory and gets another
/// chance to be recorded should the screenshot reappear.
/// </para>
/// <para>
/// Unlike <see cref="ScreenshotLiker"/>, a view has no reconcilable client-side state: it is
/// counted once, never undone, and the server response carries no count to optimistically apply.
/// It stays deliberately separate from the like path it shares no state with.
/// </para>
/// </summary>
internal sealed class ScreenshotViewRecorder(IHallOfFameApi api, IModLog log) {
  /// <summary>
  /// IDs of the screenshots already counted as viewed this session, the backing store of the
  /// at-most-once guarantee.
  /// Accessed only from the UI thread that drives navigation, like the rest of the slideshow state,
  /// so it needs no synchronization.
  /// </summary>
  private readonly HashSet<string> recordedViews = [];

  /// <summary>
  /// Records the given screenshot as viewed, unless it has already been counted this session.
  /// A failed recording is invisible to the user by design (logged silently, never surfaced as a
  /// dialog), so this is designed never to throw, and the caller can fire-and-forget it.
  /// </summary>
  internal async Task RecordView(string screenshotId) {
    // Claim the id synchronously before the round-trip: Add reports whether it was new, so a
    // screenshot already counted (or being counted) is skipped without a second request.
    if (!this.recordedViews.Add(screenshotId)) {
      return;
    }

    try {
      await api.MarkScreenshotViewed(screenshotId);
    }
    catch (Exception ex) {
      // The request failed, so the view was not actually counted: release the claim so a later
      // reappearance of this screenshot can record it.
      this.recordedViews.Remove(screenshotId);

      log.ErrorSilent(ex);
    }
  }
}
