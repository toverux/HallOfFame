using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine;

namespace HallOfFame.Systems.Capture;

/// <summary>
/// Result of a screenshot capture: the preview texture, the full-size image on its way, its size,
/// the graphics-state facts the capturer observed while rendering, and the conditions of the shot.
/// </summary>
internal readonly struct CapturedScreenshot {
  /// <summary>
  /// Completes with the full-size screenshot encoded as PNG, on the thread pool after the capture
  /// returned, faulting when its readback or its encode failed.
  /// </summary>
  internal required Task<byte[]> PngBytes { get; init; }

  /// <summary>
  /// Downscaled preview, which the GPU may still be rendering, the caller's to destroy.
  /// </summary>
  internal required RenderTexture PreviewTexture { get; init; }

  /// <summary>
  /// Pixel size of the full-size screenshot.
  /// </summary>
  internal required Vector2Int Size { get; init; }

  /// <summary>
  /// Whether all relevant graphics settings were at their highest quality when capturing.
  /// </summary>
  internal required bool AreSettingsTopQuality { get; init; }

  /// <summary>
  /// The conditions of the shot, see <see cref="RenderConditionsReader"/>, empty when they could
  /// not be read.
  /// </summary>
  internal required IReadOnlyDictionary<string, object> RenderConditions { get; init; }
}
