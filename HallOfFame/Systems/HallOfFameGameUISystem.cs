using System;
using System.IO;
using System.Reflection;
using Colossal.UI;
using Colossal.UI.Binding;
using Game.UI;
using Game.UI.InGame;
using HallOfFame.Patches;
using HallOfFame.Utils;
using HarmonyLib;
using UnityEngine;
using Object = UnityEngine.Object;

namespace HallOfFame.Systems;

/// <summary>
/// System responsible for handling the Hall of Fame in-game UI, notably the
/// screenshot taking.
/// </summary>
public sealed partial class HallOfFameGameUISystem : UISystemBase {
    /// <summary>
    /// Directory where the current screenshot is stored, just for file-serving
    /// purposes in the UI. The actual image sent to the server is kept in
    /// memory to discourage tampering.
    /// </summary>
    private static readonly string ScreenshotDirectory =
        Path.Combine(Application.temporaryCachePath, "HallOfFame");

    /// <summary>
    /// This is the method that is called when the "Take Photo" button is
    /// clicked. We will also use it for custom HoF screenshots.
    /// It is private and normally called by the `photoMode.takeScreenshot`
    /// trigger binding.
    /// </summary>
    private static readonly MethodInfo TakeScreenshotOriginalMethod =
        AccessTools.Method(typeof(PhotoModeUISystem), "TakeScreenshot") ??
        throw new MissingMethodException(
            $"Could not find method {nameof(PhotoModeUISystem)}.TakeScreenshot().");

    private PhotoModeUISystem? photoModeUISystem;

    private byte[]? latestScreenshotBytes;

    protected override void OnCreate() {
        base.OnCreate();

        try {
            this.photoModeUISystem =
                this.World.GetOrCreateSystemManaged<PhotoModeUISystem>();

            this.AddBinding(new TriggerBinding(
                "hallOfFame", "takeScreenshot", this.BeginTakeScreenshot));

            // Temp directory must be created before AddHostLocation() is called,
            // otherwise if watch mode is enabled we'll get an exception.
            Directory.CreateDirectory(HallOfFameGameUISystem.ScreenshotDirectory);

            // Adds "coui://halloffame/" host location for serving images.
            UIManager.defaultUISystem.AddHostLocation(
                "halloffame", HallOfFameGameUISystem.ScreenshotDirectory);
        }
        catch (Exception ex) {
            Mod.Log.ErrorFatal(ex);
        }
    }

    protected override void OnDestroy() {
        base.OnDestroy();

        UIManager.defaultUISystem.RemoveHostLocation("halloffame");
    }

    /// <summary>
    /// Call original Vanilla screenshot method.
    /// Our Harmony patch installed via <see cref="PhotoModeUISystemPatch"/>
    /// will call us back for custom screenshot taking.
    /// </summary>
    private void BeginTakeScreenshot() {
        PhotoModeUISystemPatch.OnCaptureScreenshot += this.ContinueTakeScreenshot;

        HallOfFameGameUISystem.TakeScreenshotOriginalMethod.Invoke(
            this.photoModeUISystem, null);
    }

    /// <summary>
    /// Called back by our Harmony patch, just before Vanilla capture.
    /// </summary>
    /// <returns>
    /// A boolean indicating whether the Vanilla capture should proceed.
    /// </returns>
    private bool ContinueTakeScreenshot() {
        PhotoModeUISystemPatch.OnCaptureScreenshot -= this.ContinueTakeScreenshot;

        // This bricks the current game session if this throws, so we will
        // handle exceptions properly here, as there is a non-zero chance of
        // failure in this section (notably due to I/O).
        try {
            // Take a supersize screenshot that is *at least* 2160 pixels (4K).
            // Height is better than width because of widescreen monitors.
            // The server will decide the final resolution, i.e. rescale to
            // 2160p if the resulting image is bigger.
            var scaleFactor = (int) Math.Ceiling(2160d / Screen.height);

            var screenshotTexture =
                ScreenCapture.CaptureScreenshotAsTexture(scaleFactor);

            this.latestScreenshotBytes = screenshotTexture.EncodeToJPG();

            Object.DestroyImmediate(screenshotTexture);

            File.WriteAllBytes(
                Path.Combine(
                    HallOfFameGameUISystem.ScreenshotDirectory,
                    "screenshot.jpg"),
                this.latestScreenshotBytes);
        }
        catch (Exception ex) {
            Mod.Log.ErrorRecoverable(ex);
        }

        return Mod.Settings.MakePlatformScreenshots;
    }
}
