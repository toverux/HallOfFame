using System;
using System.Linq;
using System.Threading.Tasks;
using HallOfFame.Domain;
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
  /// Whether one of the sink's confirmation dialogs is open, so a request for another is declined
  /// rather than stacked over it.
  /// </summary>
  private bool isConfirming;

  /// <summary>
  /// Fetches and publishes the creator's collection and stats, through a loading state.
  /// A second open while loading is ignored, leaving the first fetch to answer.
  /// Designed never to throw, so the caller can fire-and-forget it.
  /// </summary>
  internal Task Open() =>
    this.state.Status is DashboardStatus.Loading ? Task.CompletedTask : this.Load();

  /// <summary>
  /// Opens the panel straight on a screenshot's detail view, once the collection holding it is
  /// loaded: the upload panel's shortcut to the screenshot just shared.
  /// Ignored while a load is in flight, as <see cref="Open"/> is.
  /// Designed never to throw, so the caller can fire-and-forget it.
  /// </summary>
  internal async Task OpenOnScreenshot(string screenshotId) {
    if (this.state.Status is DashboardStatus.Loading) {
      return;
    }

    await this.Load();
    await this.OpenDetail(screenshotId);
  }

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
  /// <see cref="Close"/>, once the player confirms dropping the edits the form holds:
  /// the UI calls it in place of <see cref="Close"/> while its form differs from the screenshot.
  /// Designed never to throw, so the caller can fire-and-forget it.
  /// </summary>
  internal async Task ConfirmClose() {
    if (await this.ConfirmDiscardEdits()) {
      this.Close();
    }
  }

  /// <summary>
  /// <see cref="CloseDetail"/>, once the player confirms dropping the edits the form holds,
  /// as <see cref="ConfirmClose"/> is.
  /// Designed never to throw, so the caller can fire-and-forget it.
  /// </summary>
  internal async Task ConfirmCloseDetail() {
    if (await this.ConfirmDiscardEdits()) {
      this.CloseDetail();
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

    // A dialog another one replaced never answers and would hold back every later confirmation; its
    // answer is dropped anyway once the detail closes, the generation having moved on.
    this.isConfirming = false;

    this.PublishDetail(DashboardDetailState.Closed);
  }

  /// <summary>
  /// Saves an edit of the screenshot the detail view holds, then merges the answer into it and into
  /// the collection, or fetches it again when the edit picked a new showcased mod.
  /// A failed save leaves both as they were and shows the error, the form keeping its edits.
  /// An edit while another mutation is on its way is ignored.
  /// Designed never to throw, so the caller can fire-and-forget it.
  /// </summary>
  internal async Task Update(ScreenshotUpdate update) {
    if (this.detail is not {
        Status: DashboardStatus.Loaded, Screenshot: {} held, IsSaving: false, IsDeleting: false
      }) {
      return;
    }

    var generation = this.detailGeneration;

    this.PublishDetail(DashboardDetailState.Loaded(held, isSaving: true));

    try {
      var response = await api.UpdateScreenshot(held.Id, update);

      // The answer leaves out the showcased mod, so a newly picked one is fetched in full.
      var merged = update.ShowcasedModId is { Length: > 0 }
        ? await api.GetScreenshot(held.Id)
        : DashboardService.Merge(held, response, update);

      // The collection takes the edit even after Back, the server holding it either way.
      if (this.state.Status is DashboardStatus.Loaded && this.state.Stats is {} stats) {
        var screenshots = this.state.Screenshots
          .Select(item => item.Id == merged.Id ? DashboardService.MergeItem(item, merged) : item)
          .ToArray();

        this.Publish(DashboardState.Loaded(screenshots, stats));
      }

      if (generation == this.detailGeneration) {
        this.PublishDetail(DashboardDetailState.Loaded(merged));
      }
    }
    catch (Exception ex) {
      this.LogFailure(ex);

      // The form has no panel to show the message in, so the game's message dialog does.
      if (ex is HttpException) {
        sink.ShowError(ex.GetUserFriendlyMessage());
      }

      if (generation == this.detailGeneration) {
        this.PublishDetail(DashboardDetailState.Loaded(held));
      }
    }
  }

  /// <summary>
  /// Deletes the screenshot the detail view holds once the player confirms it, then drops it from
  /// the collection, returns to the grid, and refreshes the stats, which the deletion changed.
  /// A screenshot the server no longer has is dropped the same way, being gone either way.
  /// A failed deletion leaves the collection and the detail as they were and shows the error.
  /// A deletion while another mutation is on its way is ignored.
  /// Designed never to throw, so the caller can fire-and-forget it.
  /// </summary>
  internal async Task Delete() {
    if (this.detail is not {
        Status: DashboardStatus.Loaded, Screenshot: {} held, IsSaving: false, IsDeleting: false
      }) {
      return;
    }

    var generation = this.detailGeneration;

    // The detail may have closed under the dialog: a late confirmation deletes nothing.
    if (!await this.Confirm(() => sink.ConfirmDelete(held)) ||
      generation != this.detailGeneration) {
      return;
    }

    this.PublishDetail(DashboardDetailState.Loaded(held, isDeleting: true));

    try {
      try {
        await api.DeleteScreenshot(held.Id);
      }
      // The client maps a 404 to this exception: here, the screenshot was already gone.
      catch (HttpUserCompatibilityException) {
      }

      sink.PlayDeletedSound();

      // The totals are the server's: fetched again, so a figure the deletion changed does not
      // linger. A refused fetch keeps the ones held, the deletion having landed regardless.
      var stats = await this.TryRefreshStats();

      if (this.state.Status is DashboardStatus.Loaded && this.state.Stats is {} heldStats) {
        var screenshots = this.state.Screenshots.Where(item => item.Id != held.Id).ToArray();

        this.Publish(DashboardState.Loaded(screenshots, stats ?? heldStats));
      }

      if (generation == this.detailGeneration) {
        this.CloseDetail();
      }
    }
    catch (Exception ex) {
      this.LogFailure(ex);

      if (ex is HttpException) {
        sink.ShowError(ex.GetUserFriendlyMessage());
      }

      if (generation == this.detailGeneration) {
        this.PublishDetail(DashboardDetailState.Loaded(held));
      }
    }
  }

  /// <summary>
  /// Hands the screenshot the detail view holds to the slideshow and closes the panel, so the
  /// screenshot shows full screen where the panel was.
  /// Ignored while a mutation is on its way: the slideshow would be handed a record the server is
  /// about to change or drop.
  /// </summary>
  internal void ShowInSlideshow() {
    if (this.detail is not {
        Status: DashboardStatus.Loaded, Screenshot: {} held, IsSaving: false, IsDeleting: false
      }) {
      return;
    }

    sink.ShowInSlideshow(held);
    this.Close();
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
  /// Whether the player confirms dropping the edits of the screenshot the detail view holds,
  /// <c>true</c> without asking when it holds none, so no form can hold edits either.
  /// </summary>
  private async Task<bool> ConfirmDiscardEdits() {
    if (this.detail is not { Status: DashboardStatus.Loaded, Screenshot: {} held }) {
      return true;
    }

    var generation = this.detailGeneration;

    // The detail may have closed under the dialog: a late confirmation closes nothing more.
    return await this.Confirm(() => sink.ConfirmDiscardEdits(held)) &&
      generation == this.detailGeneration;
  }

  /// <summary>
  /// Asks the player through one of the sink's confirmation dialogs, declining at once while
  /// another is open.
  /// The game's app bindings hold a single dialog callback, which a second dialog replaces, so the
  /// first's answer would never arrive (read in the decompiled <c>AppBindings</c>).
  /// </summary>
  private async Task<bool> Confirm(Func<Task<bool>> ask) {
    if (this.isConfirming) {
      return false;
    }

    this.isConfirming = true;

    try {
      return await ask();
    }
    finally {
      this.isConfirming = false;
    }
  }

  /// <summary>
  /// The creator's stats fetched again, or <c>null</c> when the fetch failed, logged.
  /// </summary>
  private async Task<CreatorStats?> TryRefreshStats() {
    try {
      return await api.GetCreatorStats();
    }
    catch (Exception ex) {
      this.LogFailure(ex);

      return null;
    }
  }

  /// <summary>
  /// The held screenshot with the fields the server owns taken from its answer to an update,
  /// which leaves out the creator, the liked state, and the showcased mod, kept from the held one
  /// unless the update cleared it.
  /// </summary>
  private static Screenshot Merge(Screenshot held, Screenshot response, ScreenshotUpdate update) =>
    held with {
      CityName = response.CityName,
      CityNameLocale = response.CityNameLocale,
      CityNameLatinized = response.CityNameLatinized,
      CityNameTranslated = response.CityNameTranslated,
      Description = response.Description,
      ShareParadoxModIds = response.ShareParadoxModIds,
      ShareRenderSettings = response.ShareRenderSettings,
      Rank = response.Rank,
      ShowcasedMod = update.ShowcasedModId is "" ? null : held.ShowcasedMod
    };

  /// <summary>
  /// A card's record with what an update can change on it taken from the merged screenshot.
  /// </summary>
  private static DashboardScreenshot MergeItem(DashboardScreenshot item, Screenshot merged) =>
    item with {
      CityName = merged.CityName,
      CityNameLocale = merged.CityNameLocale,
      CityNameLatinized = merged.CityNameLatinized,
      CityNameTranslated = merged.CityNameTranslated,
      Rank = merged.Rank
    };

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
