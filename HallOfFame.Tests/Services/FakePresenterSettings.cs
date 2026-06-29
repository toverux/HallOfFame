using HallOfFame.Services;

namespace HallOfFame.Tests.Services;

/// <summary>
/// In-memory <see cref="IPresenterSettings"/> test double standing in for the few settings the
/// conductor reads.
/// Both values are plain auto-properties the test seeds, defaulting to a valid resolution and a
/// placeholder save directory, so most tests need not set them.
/// </summary>
internal sealed class FakePresenterSettings : IPresenterSettings {
  public string ScreenshotResolution { get; init; } = "4k";

  public string SaveDirectory { get; init; } = "save-directory";
}
