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

  internal required string Description { get; init; }

  internal required bool ShareModIds { get; init; }

  /// <summary>
  /// Null when the playset could not be read at capture.
  /// </summary>
  internal required IEnumerable<string>? ModIds { get; init; }

  internal required bool ShareRenderSettings { get; init; }

  internal required IDictionary<string, float> RenderSettings { get; init; }

  /// <summary>
  /// Names to numbers, text, or booleans, shared under <see cref="ShareRenderSettings"/>.
  /// </summary>
  internal required IReadOnlyDictionary<string, object> RenderConditions { get; init; }

  internal required byte[] ScreenshotData { get; init; }

  internal required ProgressHandler? UploadProgressHandler { get; init; }
}
