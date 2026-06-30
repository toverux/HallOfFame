using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Game.UI.Localization;
using HallOfFame.Domain;
using HallOfFame.Services;

namespace HallOfFame.Tests.Services;

/// <summary>
/// Handwritten <see cref="ISlideshowPresentationSink"/> test double for the conductor, mirroring
/// the recorder/delegate split of <c>FakeStore</c> and <c>FakeParadoxConnection</c>.
/// The eight void sinks are recorded passively so a test can assert on them; the lone
/// value-returning <see cref="ConfirmReport"/> is wired per test through
/// <see cref="ConfirmReportImpl"/> and defaults to declining (<c>false</c>), the safe choice that
/// performs no report.
/// </summary>
internal sealed class FakeSlideshowPresentationSink : ISlideshowPresentationSink {
  /// <summary>
  /// Decides the report confirmation; left unset, the user declines.
  /// </summary>
  internal Func<Screenshot, Task<bool>>? ConfirmReportImpl { get; init; }

  /// <summary>
  /// The last screenshot published, or <c>null</c> when none was published (or <c>null</c> was).
  /// </summary>
  internal Screenshot? LastPublishedScreenshot { get; private set; }

  /// <summary>
  /// Every value pushed to <see cref="PublishLoadError"/>, including the <c>null</c> clears.
  /// </summary>
  internal List<LocalizedString?> PublishedLoadErrors { get; } = [];

  /// <summary>
  /// Every value pushed to <see cref="SetCanAdvance"/>, in order, so a test can assert the
  /// false-then-true settle around a navigation.
  /// </summary>
  internal List<bool> CanAdvanceLog { get; } = [];

  /// <summary>
  /// The last value pushed to <see cref="SetHasPrevious"/>, or <c>null</c> when never pushed.
  /// </summary>
  internal bool? LastHasPrevious { get; private set; }

  /// <summary>
  /// Every value pushed to <see cref="SetSaving"/>, in order, so a test can assert the
  /// true-then-false toggle of a save (and that an ignored save pushed nothing).
  /// </summary>
  internal List<bool> SavingLog { get; } = [];

  /// <summary>
  /// Every message shown through <see cref="ShowError"/> (the like/report OOPS dialog).
  /// </summary>
  internal List<LocalizedString> ShownErrors { get; } = [];

  /// <summary>
  /// Number of times <see cref="ShowReportSuccess"/> was called.
  /// </summary>
  internal int ReportSuccessCount { get; private set; }

  /// <summary>
  /// Number of times <see cref="RequestRefresh"/> was called.
  /// </summary>
  internal int RefreshCount { get; private set; }

  public void PublishScreenshot(Screenshot? screenshot) =>
    this.LastPublishedScreenshot = screenshot;

  public void PublishLoadError(LocalizedString? error) =>
    this.PublishedLoadErrors.Add(error);

  public void SetCanAdvance(bool canAdvance) =>
    this.CanAdvanceLog.Add(canAdvance);

  public void SetHasPrevious(bool hasPrevious) =>
    this.LastHasPrevious = hasPrevious;

  public void SetSaving(bool isSaving) =>
    this.SavingLog.Add(isSaving);

  public void ShowError(LocalizedString message) =>
    this.ShownErrors.Add(message);

  public Task<bool> ConfirmReport(Screenshot screenshot) =>
    this.ConfirmReportImpl?.Invoke(screenshot) ?? Task.FromResult(false);

  public void ShowReportSuccess() =>
    this.ReportSuccessCount++;

  public void RequestRefresh() =>
    this.RefreshCount++;
}
