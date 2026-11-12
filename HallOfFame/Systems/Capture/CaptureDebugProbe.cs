using System.Diagnostics;
using TND.Upscaling.Framework;
using UnityEngine;
using UnityEngine.Profiling;
using UnityEngine.Rendering;
using UnityEngine.Rendering.HighDefinition;

namespace HallOfFame.Systems.Capture;

/// <summary>
/// Measures each capture for an agent driving the game: it starts one with
/// <c>CaptureUISystem.DebugCapture</c>, then reads <see cref="LastReport"/> from the unity eval, or
/// the report line in the mod's log.
/// Its recording methods compile out of Release builds, so a player's capture never pays for them.
/// </summary>
internal static class CaptureDebugProbe {
  private static readonly Stopwatch Clock = new();

  // The capture in progress, overwritten by the next one; one capture runs at a time.
  private static long graphicsDriverBytesBefore;

  private static Vector2Int rtHandleSizeBefore;

  private static double rendersStartMs;

  private static double rendersEndMs;

  private static double restoredMs;

  private static string renderStateBefore = "";

  private static string renderStateDuring = "";

  /// <summary>
  /// The measurements of the last capture to complete, null while one is scheduled by
  /// <c>CaptureUISystem.DebugCapture</c> and until it completes.
  /// </summary>
  internal static Report? LastReport { get; set; }

  #if DEBUG
  /// <summary>
  /// Render size the next capture uses instead of the planned one, set by
  /// <c>CaptureUISystem.DebugCapture</c>.
  /// </summary>
  internal static Vector2Int? RenderSizeOverride { get; set; }
  #endif

  [Conditional("DEBUG")]
  internal static void Begin(Camera camera) {
    CaptureDebugProbe.Clock.Restart();

    CaptureDebugProbe.renderStateBefore = CaptureDebugProbe.ReadRenderState(camera);

    CaptureDebugProbe.graphicsDriverBytesBefore = Profiler.GetAllocatedMemoryForGraphicsDriver();
    CaptureDebugProbe.rtHandleSizeBefore = CaptureDebugProbe.ReadRTHandleSize();
  }

  [Conditional("DEBUG")]
  internal static void MarkRendersStart(Camera camera) {
    CaptureDebugProbe.rendersStartMs = CaptureDebugProbe.Clock.Elapsed.TotalMilliseconds;

    CaptureDebugProbe.renderStateDuring = CaptureDebugProbe.ReadRenderState(camera);
  }

  [Conditional("DEBUG")]
  internal static void MarkRendersEnd() {
    CaptureDebugProbe.rendersEndMs = CaptureDebugProbe.Clock.Elapsed.TotalMilliseconds;
  }

  [Conditional("DEBUG")]
  internal static void MarkRestored() {
    CaptureDebugProbe.restoredMs = CaptureDebugProbe.Clock.Elapsed.TotalMilliseconds;
  }

  [Conditional("DEBUG")]
  internal static void End(Camera camera, Vector2Int renderSize, Vector2Int plannedRenderSize) {
    var endMs = CaptureDebugProbe.Clock.Elapsed.TotalMilliseconds;

    CaptureDebugProbe.LastReport = new Report {
      RenderSize = renderSize,
      PlannedRenderSize = plannedRenderSize,
      SetupMs = CaptureDebugProbe.rendersStartMs,
      RendersMs = CaptureDebugProbe.rendersEndMs - CaptureDebugProbe.rendersStartMs,
      RestoreMs = CaptureDebugProbe.restoredMs - CaptureDebugProbe.rendersEndMs,
      EncodeMs = endMs - CaptureDebugProbe.restoredMs,
      TotalMs = endMs,
      GraphicsDriverMiBBefore = CaptureDebugProbe.graphicsDriverBytesBefore / (1024 * 1024),
      GraphicsDriverMiBAfter = Profiler.GetAllocatedMemoryForGraphicsDriver() / (1024 * 1024),
      RTHandleSizeBefore = CaptureDebugProbe.rtHandleSizeBefore,
      RTHandleSizeAfter = CaptureDebugProbe.ReadRTHandleSize(),
      RenderStateBefore = CaptureDebugProbe.renderStateBefore,
      RenderStateDuring = CaptureDebugProbe.renderStateDuring,
      RenderStateAfter = CaptureDebugProbe.ReadRenderState(camera)
    };

    // Logged too, for the machines an agent drives without the unity eval.
    Mod.Log.Info($"{nameof(CaptureDebugProbe)}: {CaptureDebugProbe.LastReport}");
  }

  /// <summary>
  /// The upscaler that runs on the camera, and its anti-aliasing mode and SMAA quality.
  /// </summary>
  private static string ReadRenderState(Camera camera) {
    var upscaler = ScreenshotCapturer.ReadRunningUpscaler(camera.GetComponent<TNDUpscaler>());

    var cameraData = camera.GetComponent<HDAdditionalCameraData>();

    return $"{upscaler}, {cameraData.antialiasing} {cameraData.SMAAQuality}";
  }

  /// <summary>
  /// Size of HDRP's shared render targets, which grow to the largest camera rendered and stay so.
  /// </summary>
  private static Vector2Int ReadRTHandleSize() {
    return new Vector2Int(RTHandles.maxWidth, RTHandles.maxHeight);
  }

  /// <summary>
  /// One capture's measurements, its times in milliseconds from the start of the capture.
  /// Its properties are public as a record prints only its public members, and the eval shows that.
  /// </summary>
  internal sealed record Report {
    public required Vector2Int RenderSize { get; init; }

    /// <summary>
    /// The size the capture plan chose, which a Debug override replaces in
    /// <see cref="RenderSize"/>.
    /// </summary>
    public required Vector2Int PlannedRenderSize { get; init; }

    /// <summary>
    /// From the start of the capture to the first render, the graphics overrides included.
    /// </summary>
    public required double SetupMs { get; init; }

    /// <summary>
    /// The renders and the read of the image back from the GPU.
    /// </summary>
    public required double RendersMs { get; init; }

    /// <summary>
    /// The render conditions read and the graphics settings restored.
    /// </summary>
    public required double RestoreMs { get; init; }

    /// <summary>
    /// The full image and its preview encoded.
    /// </summary>
    public required double EncodeMs { get; init; }

    public required double TotalMs { get; init; }

    /// <summary>
    /// Graphics memory Unity allocated, 0 on a release player, whose profiler counters are off.
    /// </summary>
    public required long GraphicsDriverMiBBefore { get; init; }

    /// <inheritdoc cref="GraphicsDriverMiBBefore"/>
    public required long GraphicsDriverMiBAfter { get; init; }

    public required Vector2Int RTHandleSizeBefore { get; init; }

    public required Vector2Int RTHandleSizeAfter { get; init; }

    /// <summary>
    /// The upscaler and the anti-aliasing the camera ran with before the capture, during its
    /// renders, and once it ended.
    /// </summary>
    public required string RenderStateBefore { get; init; }

    /// <inheritdoc cref="RenderStateBefore"/>
    public required string RenderStateDuring { get; init; }

    /// <inheritdoc cref="RenderStateBefore"/>
    public required string RenderStateAfter { get; init; }
  }
}
