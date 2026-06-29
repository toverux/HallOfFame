namespace HallOfFame.Services;

/// <summary>
/// Narrow seam over the few <see cref="Settings"/> values <see cref="SlideshowConductor"/> reads:
/// the screenshot resolution it preloads at, and the directory it saves other creators' screenshots
/// into.
/// Like <see cref="ICreatorIdentityStore"/>, it keeps the conductor off the engine-bound
/// <see cref="Settings"/> shell so it constructs and runs off-engine under test.
/// The production implementation is <see cref="Settings"/>; tests inject an in-memory fake.
/// </summary>
internal interface IPresenterSettings {
  /// <summary>
  /// The configured screenshot resolution (e.g. <c>fhd</c> or <c>4k</c>), read lazily on each load
  /// to pick which image variant to preload.
  /// </summary>
  string ScreenshotResolution { get; }

  /// <summary>
  /// The directory other creators' screenshots are saved into from the main menu (maps to
  /// <see cref="Settings.CreatorsScreenshotSaveDirectory"/>).
  /// </summary>
  string SaveDirectory { get; }
}
