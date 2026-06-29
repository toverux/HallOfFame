using System;
using System.Threading.Tasks;
using HallOfFame.Http;
using HallOfFame.Logging;

namespace HallOfFame.Services;

/// <summary>
/// Records a screenshot as viewed against the server, as a fire-and-forget side effect of
/// navigation landing on a screenshot for the first time.
/// Unlike <see cref="ScreenshotLiker"/>, a view has no reconcilable client-side state: it is
/// recorded once, never undone, and the server response carries no count to optimistically apply.
/// So this stays a thin POST wrapper, deliberately separate from the like path it shares no state
/// with.
/// </summary>
internal sealed class ScreenshotViewRecorder(IHallOfFameApi api, IModLog log) {
  /// <summary>
  /// Records the given screenshot as viewed.
  /// A failed recording is invisible to the user by design (logged silently, never surfaced as a
  /// dialog), so this is designed never to throw, and the caller can fire-and-forget it.
  /// </summary>
  internal async Task RecordView(string screenshotId) {
    try {
      await api.MarkScreenshotViewed(screenshotId);
    }
    catch (Exception ex) {
      log.ErrorSilent(ex);
    }
  }
}
