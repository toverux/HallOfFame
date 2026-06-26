using System;
using System.Linq;
using System.Threading.Tasks;
using Game.SceneFlow;
using Game.Settings;
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
  /// Renders the screenshot and its preview, returning the encoded images and the graphics-state
  /// facts observed during the capture.
  /// </summary>
  internal static async Task<CapturedScreenshot> Capture() {
    // Read everything needed up front before changing any state. If any of this fails, there is
    // nothing to restore and the UI was not hidden yet, so it is intentionally outside the
    // try/finally below.
    //
    // Take a supersize screenshot that is *at least* 2160 pixels (4K).
    // Height is better than width because of widescreen monitors.
    // The server will decide the final resolution, i.e., rescale to 2160p if the resulting image is
    // bigger.
    var scaleFactor = (int)Math.Ceiling(2160d / Screen.height);

    var camera = Camera.main!;

    var cameraData = camera.GetComponent<HDAdditionalCameraData>();

    var dynResSettings = SharedSettings.instance.graphics
      .GetQualitySetting<DynamicResolutionScaleSettings>();

    var ssgiSettings = SharedSettings.instance.graphics
      .GetQualitySetting<SSGIQualitySettings>();

    // Previous values captured so the finally block can restore them.
    var previousDlssValue = cameraData.allowDeepLearningSuperSampling;
    var previousDynResLevel = dynResSettings.GetLevel();
    var previousSsgiQualityLevel = ssgiSettings.GetLevel();

    var width = Screen.width * scaleFactor;
    var height = Screen.height * scaleFactor;
    var renderTexture = new RenderTexture(width, height, 24);
    var screenshotTexture = new Texture2D(width, height, TextureFormat.RGB24, false);

    // Hide the UI, otherwise it will be captured in the screenshot.
    GameManager.instance.userInterface.view.enabled = false;

    // This try/finally brackets the disabling of the graphics settings, the render, and the
    // matching restore so that a mid-render exception still restores the graphics quality and
    // re-enables the UI, never leaving the game in an altered state.
    try {
      // Disable DLSS, causes grainy pictures or artifacts with some setups -- also, we already do
      // actual supersampling.
      cameraData.allowDeepLearningSuperSampling = false;

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

      // Proceed with the rendering.
      // Calling Render() multiple times is useful to let the GPU accumulate data for a cleaner and
      // sharper image: this helps load more accurate geometry and lets the antialiasing do its job
      // over multiple frames too.
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
    }
    finally {
      // Reset DLSS.
      cameraData.allowDeepLearningSuperSampling = previousDlssValue;

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

    var wasGlobalIlluminationDisabled =
      Mod.Settings.DisableGlobalIllumination &&
      previousSsgiQualityLevel != QualitySetting.Level.Disabled;

    return new CapturedScreenshot {
      PngBytes = pngScreenshotBytes,
      JpgPreviewBytes = jpgPreviewBytes,
      Size = new Vector2Int(width, height),
      WasGlobalIlluminationDisabled = wasGlobalIlluminationDisabled,
      AreSettingsTopQuality = ScreenshotCapturer.AreSettingsTopQuality()
    };
  }

  /// <summary>
  /// Verifies that all graphics settings are set to the highest possible quality.
  /// Ignores Global Illumination and Dynamic Resolution Scale settings as they are overridden
  /// during the screenshot process because they cause issues.
  /// </summary>
  private static bool AreSettingsTopQuality() {
    return SharedSettings.instance.graphics
      .qualitySettings
      .Where(settings => settings
        is not SSGIQualitySettings
        and not DynamicResolutionScaleSettings
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
}
