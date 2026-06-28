using System;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Logging;

namespace HallOfFame.Services;

/// <summary>
/// Owns the like/unlike toggle for the screenshot currently shown by a
/// <see cref="ScreenshotCarousel"/>.
/// Each toggle is applied to the carousel optimistically and right away, so every click or keypress
/// is honored even while a previous like request is still in flight; a single serialized sync loop
/// then pushes the displayed like-state to the server, coalescing rapid toggles into the fewest
/// requests and never letting two like requests race. This is how a like or unlike made right after
/// another one is no longer silently dropped while the round-trip is pending.
/// </summary>
internal sealed class ScreenshotLiker(
  ScreenshotCarousel carousel,
  IHallOfFameApi api,
  IModLog log,
  Action<Screenshot> renderScreenshot,
  Action<HttpException> reportFailure
) {
  /// <summary>
  /// Whether the sync loop is currently running.
  /// While set, further toggles only update the optimistic UI and let the running loop pick them
  /// up, rather than being dropped or spawning a second, racing loop.
  /// </summary>
  private bool isSyncing;

  /// <summary>
  /// Toggles the liked status of the current screenshot, with an optimistic UI update.
  /// Safe to call faster than the network round-trip: each call flips the displayed state at once,
  /// and the running sync loop converges to it.
  /// Returns the task of the sync loop started by this call, or a completed task when the toggle is
  /// folded into an already-running loop (or when there is no current screenshot).
  /// Designed never to throw, so the caller can fire-and-forget it.
  /// </summary>
  internal Task Toggle() {
    if (carousel.Current is null) {
      return Task.CompletedTask;
    }

    var previous = carousel.Current;

    var toggled = previous with {
      IsLiked = !previous.IsLiked,
      LikesCount = previous.LikesCount + (previous.IsLiked ? -1 : 1)
    };

    // Apply the optimistic update right away so the UI reflects the toggle on the very first input.
    carousel.ReplaceCurrent(toggled);
    renderScreenshot(toggled);

    // A sync loop is already running for this screenshot: it will observe the new displayed state
    // on its next iteration, so there is no second loop to start here.
    if (this.isSyncing) {
      return Task.CompletedTask;
    }

    // `previous` is the server-truth state before this batch of toggles: the loop reverts to it (or
    // to a later confirmed state) should a request fail.
    return this.Sync(previous);
  }

  /// <summary>
  /// Pushes the displayed like-state to the server, looping until the last successfully sent state
  /// matches what the user currently sees, then stopping.
  /// Because <see cref="Toggle"/> updates the optimistic UI on every input while this loop owns the
  /// single in-flight request, rapid toggles (e.g., like then immediately unlike) are coalesced
  /// into the fewest serialized requests: no two like requests race, and no input is dropped.
  /// On failure the optimistic update is reverted to the last state the server is known to hold,
  /// but only if the cursor is still on the screenshot being synced.
  /// </summary>
  /// <param name="serverTruth">
  /// The screenshot state as last known to the server, before the pending toggle(s).
  /// </param>
  private async Task Sync(Screenshot serverTruth) {
    this.isSyncing = true;

    try {
      var screenshotId = serverTruth.Id;

      // The state the server is known to hold: advanced after each successful request, and the
      // revert target on failure.
      var confirmed = serverTruth;

      while (true) {
        var displayed = carousel.Current;

        // The user navigated away from the screenshot being synced: stop, leaving its like-state as
        // last sent. Any further toggle starts a fresh sync on the new current screenshot.
        if (displayed is null || displayed.Id != screenshotId) {
          return;
        }

        // The server already holds what the user sees: nothing left to sync.
        if (displayed.IsLiked == confirmed.IsLiked) {
          return;
        }

        try {
          await api.LikeScreenshot(screenshotId, displayed.IsLiked);

          confirmed = displayed;
        }
        catch (HttpException ex) {
          reportFailure(ex);

          // Revert to the last confirmed server-truth state, but only if the cursor is still on the
          // screenshot we synced: the API call may have failed after the user navigated away, in
          // which case reverting would write the stale screenshot at the moved cursor and flash it
          // over the current one.
          if (carousel.Current?.Id == screenshotId) {
            carousel.ReplaceCurrent(confirmed);
            renderScreenshot(confirmed);
          }

          return;
        }
        catch (Exception ex) {
          log.ErrorRecoverable(ex);

          return;
        }
      }
    }
    finally {
      this.isSyncing = false;
    }
  }
}
