using Game.UI.Localization;
using HallOfFame.Domain;

namespace HallOfFame.Services;

/// <summary>
/// Where the Creator Dashboard's detail view stands, as the UI shows it:
/// closed while the grid shows, else the screenshot it opened on, fetched in full,
/// each status with the payload it alone carries.
/// Held apart from <see cref="DashboardState"/>, so opening a card never rewrites the collection.
/// </summary>
internal sealed record DashboardDetailState {
  internal static readonly DashboardDetailState Closed = new(DashboardStatus.Closed, null);

  internal DashboardStatus Status { get; }

  /// <summary>
  /// The screenshot the detail view opened on, <c>null</c> when closed.
  /// </summary>
  internal string? ScreenshotId { get; }

  /// <summary>
  /// The full screenshot with its showcased mod, <c>null</c> unless loaded.
  /// </summary>
  internal Screenshot? Screenshot { get; private init; }

  /// <summary>
  /// Whether an edit of the loaded screenshot is on its way to the server.
  /// </summary>
  internal bool IsSaving { get; private init; }

  /// <summary>
  /// Whether the loaded screenshot's deletion is on its way to the server.
  /// </summary>
  internal bool IsDeleting { get; private init; }

  /// <summary>
  /// Why the fetch failed, <c>null</c> unless in error.
  /// </summary>
  internal LocalizedString? Error { get; private init; }

  private DashboardDetailState(DashboardStatus status, string? screenshotId) {
    this.Status = status;
    this.ScreenshotId = screenshotId;
  }

  internal static DashboardDetailState Loading(string screenshotId) =>
    new(DashboardStatus.Loading, screenshotId);

  internal static DashboardDetailState Loaded(
    Screenshot screenshot,
    bool isSaving = false,
    bool isDeleting = false
  ) =>
    new(DashboardStatus.Loaded, screenshot.Id) {
      Screenshot = screenshot,
      IsSaving = isSaving,
      IsDeleting = isDeleting
    };

  internal static DashboardDetailState Failed(string screenshotId, LocalizedString error) =>
    new(DashboardStatus.Error, screenshotId) {
      Error = error
    };
}
