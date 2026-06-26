using System.Collections.Generic;

namespace HallOfFame.Http;

/// <summary>
/// Parameters for <see cref="IHallOfFameApi.UploadScreenshot"/>.
/// </summary>
internal sealed record UploadScreenshotParams {
  internal required string CityName { get; init; }

  internal required int CityMilestone { get; init; }

  internal required int CityPopulation { get; init; }

  internal required string? MapName { get; init; }

  internal required string? ShowcasedModId { get; init; }

  internal required string? Description { get; init; }

  internal required bool ShareModIds { get; init; }

  internal required IEnumerable<string> ModIds { get; init; }

  internal required bool ShareRenderSettings { get; init; }

  internal required IDictionary<string, float> RenderSettings { get; init; }

  internal required byte[] ScreenshotData { get; init; }

  internal required ProgressHandler? UploadProgressHandler { get; init; }
}
