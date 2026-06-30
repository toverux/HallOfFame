using System.Threading.Tasks;
using Game.UI.Localization;
using HallOfFame.Domain;

namespace HallOfFame.Services;

/// <summary>
/// Narrow outbound-effects seam through which <see cref="SlideshowConductor"/> enacts the engine
/// side effects its orchestration decides but does not perform itself: the value pushes onto the UI
/// bindings, the two user-facing dialogs, and the forced-refresh bump.
/// It replaces the scattered callbacks the system used to wire in <c>OnCreate</c>, keeping the
/// conductor free of engine-bound binding and dialog types so it constructs and runs off-engine
/// under test.
/// The production implementation is <c>SlideshowUISystem</c>; tests inject an in-memory fake.
/// </summary>
internal interface ISlideshowPresentationSink {
  /// <summary>
  /// Publishes the screenshot to display, driving both the navigation apply step and the Liker's
  /// optimistic like render.
  /// </summary>
  void PublishScreenshot(Screenshot? screenshot);

  /// <summary>
  /// Publishes a display-load error onto the load-error binding, or clears it with <c>null</c>.
  /// This is the "recoverable, shown inline" channel for next/previous/load-by-id failures,
  /// distinct from the <see cref="ShowError"/> dialog used for like and report failures.
  /// </summary>
  void PublishLoadError(LocalizedString? error);

  /// <summary>
  /// Mirrors the navigation lock's <c>CanAdvance</c> fact onto its binding after every transition.
  /// </summary>
  void SetCanAdvance(bool canAdvance);

  /// <summary>
  /// Mirrors whether there is a screenshot to scroll back to onto its binding.
  /// </summary>
  void SetHasPrevious(bool hasPrevious);

  /// <summary>
  /// Mirrors the saving-in-progress flag onto its binding while a screenshot is exported to disk.
  /// </summary>
  void SetSaving(bool isSaving);

  /// <summary>
  /// Surfaces a like or report failure to the user through the engine "OOPS" error dialog.
  /// Distinct from <see cref="PublishLoadError"/>, which is the inline display-load error channel.
  /// </summary>
  void ShowError(LocalizedString message);

  /// <summary>
  /// Asks the user to confirm reporting the given screenshot, resolving to <c>true</c> when they
  /// confirm and <c>false</c> when they cancel.
  /// The implementation wraps the engine confirmation dialog's callback in a task.
  /// </summary>
  Task<bool> ConfirmReport(Screenshot screenshot);

  /// <summary>
  /// Shows the "report submitted" success dialog.
  /// </summary>
  void ShowReportSuccess();

  /// <summary>
  /// Requests a slideshow refresh by bumping the forced-refresh binding, used both after a report
  /// and on return to the main menu.
  /// </summary>
  void RequestRefresh();
}
