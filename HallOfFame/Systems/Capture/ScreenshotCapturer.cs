using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Game.SceneFlow;
using Game.Settings;
using TND.Upscaling.Framework;
using UnityEngine;
using UnityEngine.Rendering.HighDefinition;
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
  /// <summary>
  /// Renders the screenshot and its preview, returning the encoded images, the graphics-state facts
  /// observed during the capture, and the conditions of the shot.
  /// The conditions are read here, once the shot has rendered and before the forced graphics
  /// options are restored, as a read after the capture would see the restored options and a scene
  /// that may have moved on.
  /// </summary>
  internal static async Task<CapturedScreenshot> Capture(RenderConditionsReader conditionsReader) {
    // Read everything needed up front before changing any state. If any of this fails, there is
    // nothing to restore and the UI was not hidden yet, so it is intentionally outside the
    // try/finally below.
    var camera = Camera.main!;

    CaptureDebugProbe.Begin(camera);

    var cameraData = camera.GetComponent<HDAdditionalCameraData>();

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
    var previousSsgiQualityLevel = ssgiSettings.GetLevel();

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

    var (width, height) = (renderSize.x, renderSize.y);

    var renderTexture = new RenderTexture(width, height, 24);
    var screenshotTexture = new Texture2D(width, height, TextureFormat.RGB24, false);

    Dictionary<string, object> renderConditions;

    // Hide the UI, otherwise it will be captured in the screenshot.
    GameManager.instance.userInterface.view.enabled = false;

    // This try/finally brackets the disabling of the graphics settings, the render, and the
    // matching restore so that a mid-render exception still restores the graphics quality and
    // re-enables the UI, never leaving the game in an altered state.
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

      // Disable Unity dynamic resolution upscaling, it's a low-quality profile.
      if (previousDynResLevel != QualitySetting.Level.High) {
        // We pass "High", which actually means "Disabled" as disabling this option is the better
        // quality setting.
        // We pass "apply: false" because it performs ApplyAndSave() while we want just Apply() to
        // restore the previous value just after the screenshot is taken.
        dynResSettings.SetLevel(QualitySetting.Level.High, apply: false);
        dynResSettings.Apply();
      }

      // Disable global illumination as it causes a LOT of grain in CS2's implementation of SSGI, on
      // most NVIDIA GPUs.
      if (Mod.Settings.DisableGlobalIllumination) {
        // We pass "apply: false" because it performs ApplyAndSave() while we want just Apply() to
        // restore the previous value just after the screenshot is taken.
        ssgiSettings.SetLevel(QualitySetting.Level.Disabled, apply: false);
        ssgiSettings.Apply();
      }

      // Yield to let graphics settings time to apply.
      await Task.Yield();

      camera.targetTexture = renderTexture;

      CaptureDebugProbe.MarkRendersStart(camera);

      // Proceed with the rendering.
      // Calling Render() multiple times is useful to let the GPU accumulate data for a cleaner and
      // sharper image: this helps load more accurate geometry, and lets the effects that build up
      // over frames, such as the volumetric clouds, settle.
      // You can test it on mountain ranges in the distance, for example, it's quite effective.
      // Typical values are 1, 2, 4 or 8 cycles.
      // Eight cycles is probably almost overkill, four would do the job well, but I've seen some
      // minor improvements after 4 cycles (it has diminishing returns).
      // Eight is at the limit of what's acceptable in terms of performance too.
      for (var i = 0; i < 8; i++) {
        camera.Render();
      }

      // Now, read the RenderTexture to a Texture2D.
      RenderTexture.active = renderTexture;
      screenshotTexture.ReadPixels(new Rect(0, 0, width, height), 0, 0);
      screenshotTexture.Apply();

      CaptureDebugProbe.MarkRendersEnd();

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
      // Reset the upscaler first, as the game's own GraphicsSettings.Apply() does: the quality
      // settings restored below configure the camera by whether an upscaler is active.
      if (forcedOffUpscaler is not null) {
        SetUpscaler(forcedOffUpscaler, previousUpscaler, previousUpscalerQuality);
      }

      // Reset anti-aliasing to the player's setting, or to none while an upscaler runs.
      antiAliasingSettings.Apply();

      // Reset dynamic resolution.
      if (dynResSettings.GetLevel() != previousDynResLevel) {
        dynResSettings.SetLevel(previousDynResLevel, false);
        dynResSettings.Apply();
      }

      // Reset SSGI.
      if (ssgiSettings.GetLevel() != previousSsgiQualityLevel) {
        ssgiSettings.SetLevel(previousSsgiQualityLevel, false);
        ssgiSettings.Apply();
      }

      // Reset the camera's target texture.
      camera.targetTexture = null;
      RenderTexture.active = null;

      // Re-enable the UI.
      GameManager.instance.userInterface.view.enabled = true;
    }

    CaptureDebugProbe.MarkRestored();

    await Task.Yield();

    // Encode the Texture2D to a PNG byte array.
    // Note: image encoding cannot be done in a background thread because Unity requires it to be
    // done on the main thread.
    var pngScreenshotBytes = screenshotTexture.EncodeToPNG();

    // Create a light preview image.
    var previewTexture = ScreenshotCapturer.Resize(
      screenshotTexture,
      Screen.width / 2,
      Screen.height / 2
    );

    var jpgPreviewBytes = previewTexture.EncodeToJPG(80);

    // Clean up the textures after usage.
    Object.DestroyImmediate(renderTexture);
    Object.DestroyImmediate(screenshotTexture);
    Object.DestroyImmediate(previewTexture);

    CaptureDebugProbe.End(camera, renderSize, plan.RenderSize);

    return new CapturedScreenshot {
      PngBytes = pngScreenshotBytes,
      JpgPreviewBytes = jpgPreviewBytes,
      Size = renderSize,
      WasGlobalIlluminationDisabled = wasGlobalIlluminationDisabled,
      AreSettingsTopQuality = ScreenshotCapturer.AreSettingsTopQuality(),
      RenderConditions = renderConditions
    };

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
  /// Resize a Texture2D to a new width and height.
  /// </summary>
  private static Texture2D Resize(Texture2D texture2D, int width, int height) {
    var rt = new RenderTexture(width, height, 24);
    RenderTexture.active = rt;

    Graphics.Blit(texture2D, rt);

    var result = new Texture2D(width, height);

    result.ReadPixels(new Rect(0, 0, width, height), 0, 0);
    result.Apply();

    RenderTexture.active = null;
    Object.DestroyImmediate(rt);

    return result;
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
}
