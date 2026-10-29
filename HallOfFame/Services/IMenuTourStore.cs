namespace HallOfFame.Services;

/// <summary>
/// Narrow seam over the one <see cref="Settings"/> value <see cref="MenuTour"/> keeps,
/// so the tour constructs and runs off-engine under test, like <see cref="ISlideshowSettings"/>.
/// </summary>
internal interface IMenuTourStore {
  /// <summary>
  /// Whether the player closed the main menu's tour, which then never shows again.
  /// </summary>
  bool HasSeenMenuTour { get; set; }

  /// <summary>
  /// Writes the settings to disk at once, as the game writes them only on a clean quit and a crash
  /// would show the tour again.
  /// Without applying them, which would re-enter the creator identity sync.
  /// </summary>
  void Save();
}
