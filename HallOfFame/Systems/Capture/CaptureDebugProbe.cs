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

  private static int beginFrame;

  private static int restoredFrame;

  private static int readbacksDoneFrame;

  private static double rendersStartMs;

  private static double rendersEndMs;

  private static double readbacksRequestedMs;

  private static double restoredMs;

  private static double readbacksDoneMs;

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

    CaptureDebugProbe.beginFrame = Time.frameCount;

    CaptureDebugProbe.renderStateBefore = CaptureDebugProbe.ReadRenderState(camera);

    CaptureDebugProbe.graphicsDriverBytesBefore = Profiler.GetAllocatedMemoryForGraphicsDriver();
    CaptureDebugProbe.rtHandleSizeBefore = CaptureDebugProbe.ReadRTHandleSize();
  }

  [Conditional("DEBUG")]
  internal static void MarkRendersStart() {
    CaptureDebugProbe.rendersStartMs = CaptureDebugProbe.Clock.Elapsed.TotalMilliseconds;
  }

  /// <summary>
  /// Marks the end of the renders, and reads the state of the camera's last one.
  /// </summary>
  [Conditional("DEBUG")]
  internal static void MarkRendersEnd(Camera camera) {
    CaptureDebugProbe.rendersEndMs = CaptureDebugProbe.Clock.Elapsed.TotalMilliseconds;

    CaptureDebugProbe.renderStateDuring = CaptureDebugProbe.ReadRenderState(camera);
  }

  [Conditional("DEBUG")]
  internal static void MarkReadbacksRequested() {
    CaptureDebugProbe.readbacksRequestedMs = CaptureDebugProbe.Clock.Elapsed.TotalMilliseconds;
  }

  [Conditional("DEBUG")]
  internal static void MarkRestored() {
    CaptureDebugProbe.restoredMs = CaptureDebugProbe.Clock.Elapsed.TotalMilliseconds;
    CaptureDebugProbe.restoredFrame = Time.frameCount;
  }

  [Conditional("DEBUG")]
  internal static void MarkReadbacksDone() {
    CaptureDebugProbe.readbacksDoneMs = CaptureDebugProbe.Clock.Elapsed.TotalMilliseconds;
    CaptureDebugProbe.readbacksDoneFrame = Time.frameCount;
  }

  [Conditional("DEBUG")]
  internal static void End(Camera camera, Vector2Int renderSize, Vector2Int plannedRenderSize) {
    var endMs = CaptureDebugProbe.Clock.Elapsed.TotalMilliseconds;

    CaptureDebugProbe.LastReport = new Report {
      RenderSize = renderSize,
      PlannedRenderSize = plannedRenderSize,
      SetupMs = CaptureDebugProbe.rendersStartMs,
      RendersMs = CaptureDebugProbe.rendersEndMs - CaptureDebugProbe.rendersStartMs,
      PreviewMs = CaptureDebugProbe.readbacksRequestedMs - CaptureDebugProbe.rendersEndMs,
      RestoreMs = CaptureDebugProbe.restoredMs - CaptureDebugProbe.readbacksRequestedMs,
      CaptureFrameMs = CaptureDebugProbe.restoredMs,
      CaptureFrames = CaptureDebugProbe.restoredFrame - CaptureDebugProbe.beginFrame + 1,
      ReadbackMs = CaptureDebugProbe.readbacksDoneMs - CaptureDebugProbe.restoredMs,
      ReadbackFrames = CaptureDebugProbe.readbacksDoneFrame - CaptureDebugProbe.restoredFrame,
      EncodeMs = endMs - CaptureDebugProbe.readbacksDoneMs,
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
  /// The upscaler that runs on the camera, its anti-aliasing mode and SMAA quality, and of its last
  /// render: the size it rendered at, and whether SSGI was on.
  /// </summary>
  private static string ReadRenderState(Camera camera) {
    var upscaler = ScreenshotCapturer.ReadRunningUpscaler(camera.GetComponent<TNDUpscaler>());

    var cameraData = camera.GetComponent<HDAdditionalCameraData>();

    var hdCamera = HDCamera.GetOrCreate(camera);

    var isSsgiOn = hdCamera.volumeStack.GetComponent<GlobalIllumination>().enable.value;

    return
      $"{upscaler}, {cameraData.antialiasing} {cameraData.SMAAQuality}, " +
      $"{hdCamera.actualWidth}x{hdCamera.actualHeight}, SSGI {isSsgiOn}";
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
    /// The capture's renders.
    /// </summary>
    public required double RendersMs { get; init; }

    /// <summary>
    /// The preview downscaled and both readbacks requested.
    /// </summary>
    public required double PreviewMs { get; init; }

    /// <summary>
    /// The render conditions read and the graphics settings restored.
    /// </summary>
    public required double RestoreMs { get; init; }

    /// <summary>
    /// The time the capture holds the main thread in the frame of the press, from its start to the
    /// graphics settings restored.
    /// </summary>
    public required double CaptureFrameMs { get; init; }

    /// <summary>
    /// The frames the capture spans up to the restore, 1 when it all ran in the frame of the press.
    /// </summary>
    public required int CaptureFrames { get; init; }

    /// <summary>
    /// From the restore to both readbacks done, the main thread free meanwhile.
    /// </summary>
    public required double ReadbackMs { get; init; }

    /// <inheritdoc cref="ReadbackMs"/>
    public required int ReadbackFrames { get; init; }

    /// <summary>
    /// From both readbacks done to the full image and its preview encoded on the thread pool.
    /// </summary>
    public required double EncodeMs { get; init; }

    public required double TotalMs { get; init; }

    /// <summary>
    /// Graphics memory Unity allocated, 0 on a release player, whose profiler counters are off.
    /// </summary>
    public required long GraphicsDriverMiBBefore { get; init; }

    /// <summary>
    /// As <see cref="GraphicsDriverMiBBefore"/>, still counting the capture's textures: the counter
    /// drops some time after a destroy, so reading it after theirs changes nothing, and the memory
    /// a capture holds is read again seconds later.
    /// </summary>
    public required long GraphicsDriverMiBAfter { get; init; }

    public required Vector2Int RTHandleSizeBefore { get; init; }

    public required Vector2Int RTHandleSizeAfter { get; init; }

    /// <summary>
    /// The state the camera ran with before the capture, during its renders, and once it ended, see
    /// <see cref="ReadRenderState"/>.
    /// </summary>
    public required string RenderStateBefore { get; init; }

    /// <inheritdoc cref="RenderStateBefore"/>
    public required string RenderStateDuring { get; init; }

    /// <inheritdoc cref="RenderStateBefore"/>
    public required string RenderStateAfter { get; init; }
  }
}
