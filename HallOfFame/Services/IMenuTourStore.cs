namespace HallOfFame.Services;

/// <summary>
/// Narrow seam over the one <see cref="Settings"/> value <see cref="MenuTour"/> keeps,
/// so the tour constructs and runs off-engine under test, like <see cref="ISlideshowSettings"/>.
/// </summary>
internal interface IMenuTourStore {
  /// <summary>
  /// Whether the player closed the main menu's tour, which then never shows again.
  /// The tour assigns it without saving: the game writes the settings file on close, and a save
  /// re-enters the creator identity sync.
  /// </summary>
  bool HasSeenMenuTour { get; set; }
}
