using System;
using System.Threading.Tasks;
using HallOfFame.Http;
using HallOfFame.Logging;
using HallOfFame.Utils;

namespace HallOfFame.Services;

/// <summary>
/// Owns the Creator Dashboard's behavior: its lifecycle (closed, loading, loaded, error),
/// the fetch of the creator's collection and stats, and the error policy around it.
/// It publishes through <see cref="IDashboardPresentationSink"/>,
/// which <c>DashboardUISystem</c> implements,
/// so it constructs and runs off-engine like <see cref="SlideshowConductor"/>.
/// <para>
/// There is no cache: every open fetches afresh, so the counters are as current as the server's,
/// and closing drops what was held.
/// </para>
/// </summary>
internal sealed class DashboardService(
  IHallOfFameApi api,
  IModLog log,
  IDashboardPresentationSink sink
) {
  private DashboardState state = DashboardState.Closed;

  private DashboardDetailState detail = DashboardDetailState.Closed;

  /// <summary>
  /// Bumped by every load and every close,
  /// so an answer landing after either is recognized as stale and dropped:
  /// a close during a load, then a reopen, must not show the first answer.
  /// </summary>
  private int loadGeneration;

  /// <summary>
  /// Bumped by every detail fetch and every detail close, as <see cref="loadGeneration"/> is,
  /// so a card opened while another was loading shows only its own answer.
  /// </summary>
  private int detailGeneration;

  /// <summary>
  /// Fetches and publishes the creator's collection and stats, through a loading state.
  /// A second open while loading is ignored, leaving the first fetch to answer.
  /// Designed never to throw, so the caller can fire-and-forget it.
  /// </summary>
  internal Task Open() =>
    this.state.Status is DashboardStatus.Loading ? Task.CompletedTask : this.Load();

  /// <summary>
  /// Fetches the collection and stats again while the panel is open, the error view's retry.
  /// Designed never to throw, so the caller can fire-and-forget it.
  /// </summary>
  internal Task Refresh() =>
    this.state.Status is DashboardStatus.Closed or DashboardStatus.Loading
      ? Task.CompletedTask
      : this.Load();

  /// <summary>
  /// Closes the panel and drops the held collection, discarding the answer of any load in flight.
  /// </summary>
  internal void Close() {
    if (this.state.Status is DashboardStatus.Closed) {
      return;
    }

    this.loadGeneration++;

    // The dashboard first: the closing panel keeps the detail it last rendered while its exit
    // plays, where a detail closed first would swap it back to the grid as it fades.
    this.Publish(DashboardState.Closed);
    this.CloseDetail();
  }

  /// <summary>
  /// Opens the detail view on a screenshot of the loaded collection, fetching it in full,
  /// through a loading state: the collection holds only what the grid shows.
  /// Opening it again after a failure is the detail's retry.
  /// Designed never to throw, so the caller can fire-and-forget it.
  /// </summary>
  internal async Task OpenDetail(string screenshotId) {
    if (this.state.Status is not DashboardStatus.Loaded) {
      return;
    }

    var generation = ++this.detailGeneration;

    this.PublishDetail(DashboardDetailState.Loading(screenshotId));

    try {
      var screenshot = await api.GetScreenshot(screenshotId);

      if (generation != this.detailGeneration) {
        return;
      }

      this.PublishDetail(DashboardDetailState.Loaded(screenshot));
    }
    catch (Exception ex) {
      this.LogFailure(ex);

      if (generation != this.detailGeneration) {
        return;
      }

      this.PublishDetail(DashboardDetailState.Failed(screenshotId, ex.GetUserFriendlyMessage()));
    }
  }

  /// <summary>
  /// Returns to the grid, discarding the answer of any detail fetch in flight.
  /// </summary>
  internal void CloseDetail() {
    if (this.detail.Status is DashboardStatus.Closed) {
      return;
    }

    this.detailGeneration++;

    this.PublishDetail(DashboardDetailState.Closed);
  }

  private async Task Load() {
    var generation = ++this.loadGeneration;

    // A reload replaces the collection the detail view was opened from.
    this.CloseDetail();
    this.Publish(DashboardState.Loading);

    try {
      // Both requests run concurrently; either failing fails the load.
      var screenshotsTask = api.GetMyScreenshots();
      var statsTask = api.GetCreatorStats();

      await Task.WhenAll(screenshotsTask, statsTask);

      if (generation != this.loadGeneration) {
        return;
      }

      this.Publish(DashboardState.Loaded(await screenshotsTask, await statsTask));
    }
    catch (Exception ex) {
      this.LogFailure(ex);

      if (generation != this.loadGeneration) {
        return;
      }

      this.Publish(DashboardState.Failed(ex.GetUserFriendlyMessage()));
    }
  }

  /// <summary>
  /// Logs a failed request silently when the network or the server failed it,
  /// which the panel shows already, and recoverably otherwise, as a bug of the mod's.
  /// </summary>
  private void LogFailure(Exception ex) {
    if (ex is HttpException) {
      log.ErrorSilent(ex);
    }
    else {
      log.ErrorRecoverable(ex);
    }
  }

  private void Publish(DashboardState newState) {
    this.state = newState;

    sink.Publish(newState);
  }

  private void PublishDetail(DashboardDetailState newDetail) {
    this.detail = newDetail;

    sink.PublishDetail(newDetail);
  }
}
