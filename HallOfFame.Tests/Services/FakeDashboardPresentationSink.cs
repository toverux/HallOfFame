using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Game.UI.Localization;
using HallOfFame.Domain;
using HallOfFame.Services;

namespace HallOfFame.Tests.Services;

/// <summary>
/// Handwritten <see cref="IDashboardPresentationSink"/> test double recording every push,
/// in one ordered log so a test can assert what was published before what.
/// </summary>
internal sealed class FakeDashboardPresentationSink : IDashboardPresentationSink {
  /// <summary>
  /// Every push of a state in order, by its status's name,
  /// a loaded one followed by its screenshots' IDs (ex. "Loaded:a,b"),
  /// and a detail's prefixed and followed by its screenshot's ID (ex. "Detail:Loading:a"),
  /// "Saving" or "Deleting" while a mutation is on its way (ex. "Detail:Saving:a").
  /// </summary>
  internal List<string> Log { get; } = [];

  internal DashboardState LastState { get; private set; } = DashboardState.Closed;

  internal DashboardDetailState LastDetail { get; private set; } = DashboardDetailState.Closed;

  internal List<LocalizedString> Errors { get; } = [];

  /// <summary>
  /// Answers the delete confirmation, declining when unwired.
  /// </summary>
  internal Func<Screenshot, Task<bool>>? ConfirmDeleteImpl { get; init; }

  internal List<Screenshot> ShownInSlideshow { get; } = [];

  internal int DeletedSoundCount { get; private set; }

  public void Publish(DashboardState state) {
    this.LastState = state;

    if (state.Status is DashboardStatus.Loaded) {
      var ids = string.Join(",", state.Screenshots.Select(screenshot => screenshot.Id));

      this.Log.Add($"{state.Status}:{ids}");
    }
    else {
      this.Log.Add(state.Status.ToString());
    }
  }

  public void PublishDetail(DashboardDetailState detail) {
    this.LastDetail = detail;

    var status = detail switch {
      { IsSaving: true } => "Saving",
      { IsDeleting: true } => "Deleting",
      _ => detail.Status.ToString()
    };

    this.Log.Add(
      detail.ScreenshotId is null ? $"Detail:{status}" : $"Detail:{status}:{detail.ScreenshotId}"
    );
  }

  public void ShowError(LocalizedString message) => this.Errors.Add(message);

  public Task<bool> ConfirmDelete(Screenshot screenshot) =>
    this.ConfirmDeleteImpl?.Invoke(screenshot) ?? Task.FromResult(false);

  public void PlayDeletedSound() => this.DeletedSoundCount++;

  public void ShowInSlideshow(Screenshot screenshot) => this.ShownInSlideshow.Add(screenshot);
}
