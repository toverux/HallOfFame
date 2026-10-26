using System.Threading.Tasks;
using Game.UI.Localization;
using HallOfFame.Domain;

namespace HallOfFame.Services;

/// <summary>
/// Outbound-effects seam through which <see cref="DashboardService"/> pushes
/// what the Creator Dashboard shows,
/// keeping the service free of engine-bound binding types so it runs off-engine under test.
/// The production implementation is <c>DashboardUISystem</c>; tests inject an in-memory fake.
/// </summary>
internal interface IDashboardPresentationSink {
  void Publish(DashboardState state);

  void PublishDetail(DashboardDetailState detail);

  /// <summary>
  /// Shows a failed edit's or deletion's message in the mod's error dialog.
  /// </summary>
  void ShowError(LocalizedString message);

  /// <summary>
  /// Asks the player to confirm deleting the screenshot, for good, through the game's
  /// confirmation dialog, resolving to <c>true</c> when they confirm.
  /// </summary>
  Task<bool> ConfirmDelete(Screenshot screenshot);

  /// <summary>
  /// Plays the sound of a deletion landing, the bulldozer's last.
  /// </summary>
  void PlayDeletedSound();

  /// <summary>
  /// Puts the screenshot on the slideshow, which the panel closes over.
  /// </summary>
  void ShowInSlideshow(Screenshot screenshot);
}
