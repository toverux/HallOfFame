using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Colossal;
using Game.Rendering;
using Game.SceneFlow;
using Game.Settings;
using TND.Upscaling.Framework;
using Unity.Collections;
using Unity.Collections.LowLevel.Unsafe;
using Unity.Entities;
using UnityEngine;
using UnityEngine.Experimental.Rendering;
using UnityEngine.Rendering.HighDefinition;
using AsyncGPUReadback = UnityEngine.Rendering.AsyncGPUReadback;
using Object = UnityEngine.Object;

namespace HallOfFame.Systems.Capture;

/// <summary>
/// Renders a high-resolution screenshot of the current camera view, temporarily forcing
/// quality-friendly graphics settings and restoring them afterward.
/// Engine-bound and therefore not unit-testable off-engine; it intentionally has no interface
/// because the only consumer (the capture system) is itself an untestable ECS system, so a fake
/// would never be used.
/// </summary>
internal static class ScreenshotCapturer {
  // The custom pass drawing the outlines of the selected and hovered objects.
  private const string OutlinesPassName = "Outlines Pass";

  /// <summary>
  /// Renders the screenshot and its preview in the frame of the call, and returns in that frame
  /// with the preview texture, the full image still to read back from the GPU and encode on the
  /// thread pool, the graphics-state facts observed during the capture, and the conditions of the
  /// shot.
  /// The conditions are read once the shot has rendered and before the forced graphics options are
  /// restored, as a read after the capture would see the restored options and a scene that may have
  /// moved on.
  /// </summary>
  internal static async Task<CapturedScreenshot> Capture(RenderConditionsReader conditionsReader) {
    // Read everything needed up front before changing any state. If any of this fails, there is
    // nothing to restore, so it is intentionally outside the try/finally below.
    var camera = Camera.main!;

    CaptureDebugProbe.Begin(camera);

    var cameraData = camera.GetComponent<HDAdditionalCameraData>();

    var uiView = GameManager.instance.userInterface.view;

    var renderingSystem =
      World.DefaultGameObjectInjectionWorld.GetExistingSystemManaged<RenderingSystem>();

    var graphics = SharedSettings.instance.graphics;

    var antiAliasingSettings = graphics.GetQualitySetting<AntiAliasingQualitySettings>();

    var dynResSettings = graphics.GetQualitySetting<DynamicResolutionScaleSettings>();

    var ssgiSettings = graphics.GetQualitySetting<SSGIQualitySettings>();

    var upscalerComponent = camera.GetComponent<TNDUpscaler>();

    var runningUpscaler = ScreenshotCapturer.ReadRunningUpscaler(upscalerComponent);

    // The component to switch off for the capture and back on after it, null when it is off.
    // Keyed on the component, not on its active upscaler: an enabled component renders at its
    // reduced scale whether or not an upscaler is active.
    var forcedOffUpscaler = upscalerComponent is { enabled: true } ? upscalerComponent : null;

    // Previous values captured so the finally block can restore them.
    var previousUpscaler = graphics.upscaler;
    var previousUpscalerQuality = forcedOffUpscaler?.GetQuality() ?? UpscalerQuality.Off;
    var previousDynResLevel = dynResSettings.GetLevel();
    var previousAllowDynamicResolution = cameraData.allowDynamicResolution;
    var previousSsgiQualityLevel = ssgiSettings.GetLevel();

    // Photo mode keeps the overlays hidden while it is open, so they are put back as they were, not
    // shown. IsPassEnabled ignores its second argument.
    var wasOverlayHidden = renderingSystem.hideOverlay;
    var wasOutlinesPassEnabled = CustomPassCache.IsPassEnabled(
      ScreenshotCapturer.OutlinesPassName,
      enabled: true
    );

    var wasGlobalIlluminationDisabled =
      Mod.Settings.DisableGlobalIllumination &&
      previousSsgiQualityLevel != QualitySetting.Level.Disabled;

    // No step of the capture reads the Wine check, so it is not run.
    var plan = ScreenshotCapturer.Plan(
      new Vector2Int(Screen.width, Screen.height),
      runningUpscaler,
      isWine: false
    );

    var renderSize = plan.RenderSize;

    #if DEBUG
    renderSize = CaptureDebugProbe.RenderSizeOverride ?? renderSize;
    #endif

    var renderTexture = new RenderTexture(renderSize.x, renderSize.y, 24);

    // The preview is downscaled in two steps, to the screen size then to half of it: a bilinear
    // sample averages at most four texels, so a single step from several times the size skips most
    // of them and makes the preview grainy.
    var screenSizeTexture = new RenderTexture(Screen.width, Screen.height, 0);
    var previewTexture = new RenderTexture(Screen.width / 2, Screen.height / 2, 0);

    // Null until its readback is requested.
    PendingImage? pendingImage = null;

    // Once returned, the preview texture is the caller's to destroy.
    var isPreviewHandedOver = false;

    try {
      Dictionary<string, object> renderConditions;

      // This try/finally brackets the disabling of the graphics settings, the render, and the
      // matching restore so that a mid-render exception still restores the graphics quality, never
      // leaving the game in an altered state.
      try {
        // Disable the upscaler (DLSS, FSR, or XeSS): it renders below the target size, which we
        // already supersample, and causes grainy pictures or artifacts with some setups.
        if (forcedOffUpscaler is not null) {
          SetUpscaler(forcedOffUpscaler, GraphicsSettings.Upscaler.None, UpscalerQuality.Off);
        }

        // Force the game's best anti-aliasing, high-quality SMAA, whatever the player's setting: it
        // can be off or FXAA, and the game hides it while an upscaler runs.
        // TAA would erase thin geometry such as cables and wires, and an upscaler at native
        // resolution does no better than SMAA at the size we render.
        cameraData.antialiasing =
          HDAdditionalCameraData.AntialiasingMode.SubpixelMorphologicalAntiAliasing;

        cameraData.SMAAQuality = HDAdditionalCameraData.SMAAQualityLevel.High;

        // Disable dynamic resolution, which renders below the target size, through the camera: the
        // render pipeline reads its flag at every render, where the game's setting reaches the
        // scale only at the next frame's update.
        cameraData.allowDynamicResolution = false;

        // Disable global illumination as it causes a LOT of grain in CS2's implementation of SSGI,
        // on most NVIDIA GPUs.
        if (Mod.Settings.DisableGlobalIllumination) {
          // We pass "apply: false" because it performs ApplyAndSave() while we want just Apply() to
          // restore the previous value just after the screenshot is taken.
          ssgiSettings.SetLevel(QualitySetting.Level.Disabled, apply: false);
          ssgiSettings.Apply();
        }

        camera.targetTexture = renderTexture;

        CaptureDebugProbe.MarkRendersStart();

        // Hide the UI from the renders alone, as it is drawn into the camera's output: it is back
        // on before the frame's own render, so it never leaves the screen.
        uiView.enabled = false;

        // Hide the overlays (notification icons, area and district borders, routes) and the
        // selection outlines from the renders too, as the game's own save previews do: photo mode
        // hides the overlays, but a capture taken outside it would show them.
        renderingSystem.hideOverlay = true;
        CustomPassCache.SetPassEnabled(ScreenshotCapturer.OutlinesPassName, enabled: false);

        try {
          // Calling Render() multiple times is useful to let the GPU accumulate data for a cleaner
          // and sharper image: this helps load more accurate geometry, and lets the effects that
          // build up over frames, such as the volumetric clouds, settle.
          // You can test it on mountain ranges in the distance, for example, it's quite effective.
          // Typical values are 1, 2, 4 or 8 cycles.
          // Eight cycles is probably almost overkill, four would do the job well, but I've seen
          // some minor improvements after 4 cycles (it has diminishing returns).
          // Eight is at the limit of what's acceptable in terms of performance too.
          for (var i = 0; i < 8; i++) {
            camera.Render();
          }
        }
        finally {
          uiView.enabled = true;
          renderingSystem.hideOverlay = wasOverlayHidden;
          CustomPassCache.SetPassEnabled(
            ScreenshotCapturer.OutlinesPassName,
            wasOutlinesPassEnabled
          );
        }

        CaptureDebugProbe.MarkRendersEnd(camera);

        Graphics.Blit(renderTexture, screenSizeTexture);
        Graphics.Blit(screenSizeTexture, previewTexture);

        pendingImage = ScreenshotCapturer.ReadBackAndEncode(
          renderTexture,
          ScreenshotCapturer.EncodePng
        );

        CaptureDebugProbe.MarkReadbacksRequested();

        renderConditions = conditionsReader.Read(
          camera,
          new RenderConditionsReader.CaptureOverrides(
            IsUpscalerForcedOff: forcedOffUpscaler is not null,
            IsDynamicResolutionForcedOff: previousDynResLevel != QualitySetting.Level.High,
            IsGlobalIlluminationForcedOff: wasGlobalIlluminationDisabled
          )
        );
      }
      finally {
        // Reset dynamic resolution before the upscaler, which renders through it.
        cameraData.allowDynamicResolution = previousAllowDynamicResolution;

        // Reset the upscaler before the quality settings, as the game's own
        // GraphicsSettings.Apply() does: the quality settings restored below configure the camera
        // by whether an upscaler is active.
        if (forcedOffUpscaler is not null) {
          SetUpscaler(forcedOffUpscaler, previousUpscaler, previousUpscalerQuality);
        }

        // Reset anti-aliasing to the player's setting, or to none while an upscaler runs.
        antiAliasingSettings.Apply();

        // Reset SSGI.
        if (ssgiSettings.GetLevel() != previousSsgiQualityLevel) {
          ssgiSettings.SetLevel(previousSsgiQualityLevel, false);
          ssgiSettings.Apply();
        }

        // Reset the camera's target texture.
        camera.targetTexture = null;
        RenderTexture.active = null;
      }

      CaptureDebugProbe.MarkRestored();

      var areSettingsTopQuality = ScreenshotCapturer.AreSettingsTopQuality();

      CaptureDebugProbe.EndOnceEncoded(pendingImage.Value, camera, renderSize, plan.RenderSize);

      isPreviewHandedOver = true;

      return new CapturedScreenshot {
        PngBytes = pendingImage.Value.Encoded,
        PreviewTexture = previewTexture,
        Size = renderSize,
        WasGlobalIlluminationDisabled = wasGlobalIlluminationDisabled,
        AreSettingsTopQuality = areSettingsTopQuality,
        RenderConditions = renderConditions
      };
    }
    catch when (pendingImage is not null) {
      // A native encode cannot be cancelled, so a failed capture waits for its full image's, which
      // the next capture's would otherwise run beside; WhenAny never throws.
      await Task.WhenAny(pendingImage.Value.Encoded);

      throw;
    }
    finally {
      // Not awaited, as the full image's readback ends long after the capture returns.
      _ = ScreenshotCapturer.DestroyOnceRead(
        pendingImage?.Read,
        isPreviewHandedOver
          ? [renderTexture, screenSizeTexture]
          : [renderTexture, screenSizeTexture, previewTexture]
      );
    }

    // Switches the upscaler without saving the change, and without UpscalerManager.Apply(): the
    // MSAA it restores is a render pipeline setting, whose every change rebuilds the pipeline.
    // The setting changes too, as the game's quality settings read it to know whether an upscaler
    // runs, anti-aliasing among them.
    void SetUpscaler(
      TNDUpscaler component,
      GraphicsSettings.Upscaler setting,
      UpscalerQuality quality
    ) {
      graphics.upscaler = setting;

      // Off also disables the component, which brings the render scale back to full size.
      component.SetQuality(quality);
    }
  }

  /// <summary>
  /// The upscaler (DLSS, FSR, or XeSS) that runs on the camera, None when none does, read from its
  /// component: the setting can name one that does not run, for example one the GPU does not
  /// support.
  /// </summary>
  internal static UpscalerName ReadRunningUpscaler(TNDUpscaler? component) {
    return component is { enabled: true } ? component.GetActiveUpscaler() : UpscalerName.None;
  }

  /// <summary>
  /// Decides a capture's parameters from the screen size, the upscaler that runs on the camera
  /// (None when none does), and whether the game runs under Wine.
  /// </summary>
  internal static CapturePlan Plan(
    Vector2Int screenSize,
    UpscalerName runningUpscaler,
    bool isWine
  ) {
    // Take a supersize screenshot that is *at least* 2160 pixels (4K).
    // Height is better than width because of widescreen monitors.
    // The server will decide the final resolution, i.e., rescale to 2160p if the resulting image is
    // bigger.
    var scaleFactor = (int) Math.Ceiling(2160d / screenSize.y);

    return new CapturePlan(
      screenSize * scaleFactor,
      IsXessPrecautionNeeded: runningUpscaler is UpscalerName.XeSS3 && isWine
    );
  }

  /// <summary>
  /// Verifies that all graphics settings are set to the highest possible quality.
  /// Ignores the Anti-Aliasing, Global Illumination, and Dynamic Resolution Scale settings, as the
  /// screenshot process overrides them.
  /// </summary>
  private static bool AreSettingsTopQuality() {
    return SharedSettings.instance.graphics
      .qualitySettings
      .Where(settings => settings
        is not AntiAliasingQualitySettings and
        not SSGIQualitySettings and
        not DynamicResolutionScaleSettings
      )
      .All(settings => {
          var highestLevel = settings
            .EnumerateAvailableLevels()
            .Last(level => level != QualitySetting.Level.Custom);

          return settings.GetLevel() >= highestLevel;
        }
      );
  }

  /// <summary>
  /// Reads a texture back from the GPU without waiting for it, into a persistent RGBA array, then
  /// encodes the array on the thread pool and frees it, whatever the outcome.
  /// </summary>
  private static PendingImage ReadBackAndEncode(
    Texture texture,
    Func<NativeArray<byte>, Vector2Int, NativeArray<byte>> encode
  ) {
    var size = new Vector2Int(texture.width, texture.height);

    var pixels = new NativeArray<byte>(
      size.x * size.y * 4,
      Allocator.Persistent,
      NativeArrayOptions.UninitializedMemory
    );

    var read = new TaskCompletionSource<bool>();

    try {
      // The outcome is read in the callback: once the frame the request completed in has passed,
      // the request reports an error and a 0x0 size, though it wrote the array.
      AsyncGPUReadback.RequestIntoNativeArray(
        ref pixels,
        texture,
        0,
        TextureFormat.RGBA32,
        request => read.SetResult(!request.hasError)
      );
    }
    catch {
      pixels.Dispose();

      throw;
    }

    return new PendingImage(read.Task, EncodeAsync());

    // The encode alone frees the array, as it can outlive the capture.
    async Task<byte[]> EncodeAsync() {
      try {
        if (!await read.Task) {
          throw new InvalidOperationException(
            $"The GPU readback of a {size.x}x{size.y} capture texture failed."
          );
        }

        return await Task.Run(() => {
            using var encoded = encode(pixels, size);

            return encoded.ToArray();
          }
        );
      }
      finally {
        pixels.Dispose();
      }
    }
  }

  /// <summary>
  /// Encodes an RGBA image to an RGB PNG: the capture is opaque, so an alpha channel would only
  /// make the file larger.
  /// </summary>
  private static unsafe NativeArray<byte> EncodePng(NativeArray<byte> rgba, Vector2Int size) {
    using var rgb = new NativeArray<byte>(
      size.x * size.y * 3,
      Allocator.Persistent,
      NativeArrayOptions.UninitializedMemory
    );

    // One native strided copy, the first three bytes of every four: a managed loop pays a call per
    // byte through the NativeArray indexer on Mono.
    UnsafeUtility.MemCpyStride(
      rgb.GetUnsafePtr(),
      3,
      rgba.GetUnsafeReadOnlyPtr(),
      4,
      3,
      size.x * size.y
    );

    return ImageConversion.EncodeNativeArrayToPNG(
      rgb,
      GraphicsFormat.R8G8B8_SRGB,
      (uint) size.x,
      (uint) size.y
    );
  }

  /// <summary>
  /// Destroys the capture's textures once <paramref name="read"/>, the full image's readback, has
  /// completed, or at once when it was never requested: the GPU reads them until then.
  /// </summary>
  private static async Task DestroyOnceRead(Task? read, IEnumerable<Texture> textures) {
    if (read is not null) {
      // WhenAny never throws, so the textures are destroyed whatever the readback's outcome.
      await Task.WhenAny(read);
    }

    foreach (var texture in textures) {
      Object.DestroyImmediate(texture);
    }
  }

  /// <summary>
  /// Parameters of one capture, see <see cref="Plan"/>.
  /// </summary>
  /// <param name="RenderSize">Pixel size the screenshot renders at.</param>
  /// <param name="IsXessPrecautionNeeded">
  /// Whether the capture must take the Linux XeSS precaution: XeSS has frozen the game after a
  /// capture under Wine, whatever the GPU, as DXVK can present one vendor's card as another's.
  /// </param>
  internal readonly record struct CapturePlan(Vector2Int RenderSize, bool IsXessPrecautionNeeded);

  /// <summary>
  /// An image on its way from the GPU to its encoded bytes, see <see cref="ReadBackAndEncode"/>.
  /// </summary>
  /// <param name="Read">
  /// Completes once the GPU has written the array, after which the texture can be destroyed; never
  /// faults.
  /// </param>
  /// <param name="Encoded">
  /// Completes with the encoded image, faulting when the readback or the encode failed.
  /// </param>
  internal readonly record struct PendingImage(Task Read, Task<byte[]> Encoded);
}
