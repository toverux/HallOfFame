using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using Colossal.PSI.Environment;
using Colossal.UI;
using Colossal.UI.Binding;
using Game;
using Game.City;
using Game.SceneFlow;
using Game.Simulation;
using Game.UI;
using Game.UI.InGame;
using HallOfFame.Patches;
using HallOfFame.Utils;
using HarmonyLib;
using Unity.Entities;
using UnityEngine;
using Object = UnityEngine.Object;

namespace HallOfFame.Systems;

/// <summary>
/// System responsible for handling the Hall of Fame in-game UI, notably the
/// screenshot taking.
/// </summary>
public sealed partial class HallOfFameGameUISystem : UISystemBase {
    private const string BindingGroup = "hallOfFame.game";

    /// <summary>
    /// Directory where the current screenshot is stored, just for file-serving
    /// purposes in the UI. The actual image sent to the server is kept in
    /// memory to discourage tampering.
    /// </summary>
    private static readonly string ScreenshotDirectory = Path.Combine(
        EnvPath.kCacheDataPath, "HallOfFame");

    /// <summary>
    /// File path of the screenshot.
    /// <seealso cref="ScreenshotDirectory"/>
    /// </summary>
    private static readonly string ScreenshotFile = Path.Combine(
        HallOfFameGameUISystem.ScreenshotDirectory, "screenshot.jpg");

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

    private CitySystem? citySystem;

    private CityConfigurationSystem? cityConfigurationSystem;

    private PhotoModeUISystem? photoModeUISystem;

    private EntityQuery milestoneLevelQuery;

    /// <summary>
    /// Current screenshot snapshot.
    /// Null if no screenshot is being displayed/uploaded.
    /// </summary>
    private ScreenshotSnapshot? CurrentScreenshot {
        get => this.currentScreenshotValue;
        set {
            this.currentScreenshotValue = value;

            // Optimization: only enable live bindings when a screenshot is
            // being displayed/uploaded.
            // Run on next frame to let the UI update one last time.
            GameManager.instance.RegisterUpdater(() => {
                this.Enabled = value is not null;
            });
        }
    }

    /// <summary>
    /// Backing field for <see cref="CurrentScreenshot"/>.
    /// </summary>
    private ScreenshotSnapshot? currentScreenshotValue;

    protected override void OnCreate() {
        base.OnCreate();

        try {
            // Re-enabled when there is an active screenshot.
            this.Enabled = false;

            this.citySystem = this.World.GetOrCreateSystemManaged<CitySystem>();

            this.cityConfigurationSystem =
                this.World.GetOrCreateSystemManaged<CityConfigurationSystem>();

            this.photoModeUISystem =
                this.World.GetOrCreateSystemManaged<PhotoModeUISystem>();

            this.milestoneLevelQuery =
                this.GetEntityQuery(ComponentType.ReadOnly<MilestoneLevel>());

            this.AddUpdateBinding(new GetterValueBinding<string>(
                HallOfFameGameUISystem.BindingGroup, "cityName",
                this.GetCityName));

            this.AddUpdateBinding(new GetterValueBinding<ScreenshotSnapshot?>(
                HallOfFameGameUISystem.BindingGroup, "screenshotSnapshot",
                () => this.CurrentScreenshot,
                new ValueWriter<ScreenshotSnapshot?>().Nullable()));

            this.AddBinding(new TriggerBinding(
                HallOfFameGameUISystem.BindingGroup, "takeScreenshot",
                this.BeginTakeScreenshot));

            this.AddBinding(new TriggerBinding(
                HallOfFameGameUISystem.BindingGroup, "clearScreenshot",
                this.ClearScreenshot));

            // Temp directory must be created before AddHostLocation() is called,
            // otherwise if watch mode is enabled we'll get an exception.
            Directory.CreateDirectory(HallOfFameGameUISystem.ScreenshotDirectory);

            // Adds "coui://halloffame/" host location for serving images.
            UIManager.defaultUISystem.AddHostLocation(
                "halloffame",
                HallOfFameGameUISystem.ScreenshotDirectory,
                // True by default, but it makes the whole UI reload when an
                // image changes with --uiDeveloperMode. But we don't desire
                // that for this host, whether in dev mode or not.
                shouldWatch: false);
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
    /// Get the name of the city.
    /// </summary>
    private string GetCityName() {
        return this.cityConfigurationSystem?.cityName ?? string.Empty;
    }

    /// <summary>
    /// Get the current achieved milestone level.
    /// </summary>
    private int GetAchievedMilestone() {
        return this.milestoneLevelQuery.IsEmptyIgnoreFilter
            ? 0
            : this.milestoneLevelQuery
                .GetSingleton<MilestoneLevel>().m_AchievedMilestone;
    }

    /// <summary>
    /// Get the current population of the city.
    /// </summary>
    private int GetPopulation() {
        if (this.citySystem is null) {
            return 0;
        }

        return this.EntityManager.HasComponent<Population>(this.citySystem.City)
            ? this.EntityManager.GetComponentData<Population>(this.citySystem.City)
                .m_Population
            : 0;
    }

    /// <summary>
    /// Call original Vanilla screenshot method.
    /// Our Harmony patch installed via <see cref="PhotoModeUISystemPatch"/>
    /// will call us back (<see cref="ContinueTakeScreenshot"/>) for custom
    /// screenshot taking.
    /// </summary>
    private void BeginTakeScreenshot() {
        PhotoModeUISystemPatch.OnCaptureScreenshot += this.ContinueTakeScreenshot;

        // This is unlikely to break except if the Vanilla method changes
        // parameters signature, but we will make sure to handle that properly.
        // Note that this does not encapsulate ContinueTakeScreenshot() which
        // is executed in a coroutine, and has its own try/catch.
        try {
            HallOfFameGameUISystem.TakeScreenshotOriginalMethod.Invoke(
                this.photoModeUISystem, null);
        }
        catch (Exception ex) {
            Mod.Log.ErrorRecoverable(ex);

            PhotoModeUISystemPatch.OnCaptureScreenshot -= this.ContinueTakeScreenshot;
        }
    }

    /// <summary>
    /// Called back by our Harmony patch, just before Vanilla capture.
    /// </summary>
    /// <returns>
    /// A boolean indicating whether the Vanilla capture should proceed.
    /// </returns>
    private bool ContinueTakeScreenshot() {
        PhotoModeUISystemPatch.OnCaptureScreenshot -= this.ContinueTakeScreenshot;

        // Slightly deferred take photo sound, otherwise it seems to play too
        // early. Vanilla screenshot capture is actually doing the same thing on
        // UI-side with a `setTimeout()`bb.
        GameManager.instance.RegisterUpdater(this.PlayTakePhotoSound);

        // This bricks the current game session if this throws, so we will
        // handle exceptions properly here, as there is a non-zero chance of
        // failure in this section (notably due to I/O).
        try {
            // Take a supersize screenshot that is *at least* 2160 pixels (4K).
            // Height is better than width because of widescreen monitors.
            // The server will decide the final resolution, i.e. rescale to
            // 2160p if the resulting image is bigger.
            var scaleFactor = (int)Math.Ceiling(2160d / Screen.height);

            var screenshotTexture =
                ScreenCapture.CaptureScreenshotAsTexture(scaleFactor);

            var screenshotBytes = screenshotTexture.EncodeToJPG();

            var screenshotSize = new Vector2Int(
                screenshotTexture.width, screenshotTexture.height);

            Object.DestroyImmediate(screenshotTexture);

            File.WriteAllBytes(
                HallOfFameGameUISystem.ScreenshotFile,
                screenshotBytes);

            this.CurrentScreenshot = new ScreenshotSnapshot(
                this.GetAchievedMilestone(),
                this.GetPopulation(),
                screenshotBytes,
                screenshotSize);
        }
        catch (Exception ex) {
            Mod.Log.ErrorRecoverable(ex);

            this.CurrentScreenshot = null;
        }

        return Mod.Settings.MakePlatformScreenshots;
    }

    private void ClearScreenshot() {
        if (this.CurrentScreenshot is null) {
            Mod.Log.Warn(
                $"Call to {nameof(this.ClearScreenshot)} with no active screenshot.");
        }

        try {
            File.Delete(HallOfFameGameUISystem.ScreenshotFile);
        }
        catch (Exception ex) {
            Mod.Log.ErrorRecoverable(ex);
        }
        finally {
            this.CurrentScreenshot = null;
        }
    }

    private void PlayTakePhotoSound() {
        try {
            // ReSharper disable once Unity.UnknownResource
            var sounds = Resources.Load<UISoundCollection>("Audio/UI Sounds");
            sounds.PlaySound("take-photo");
        }
        catch (Exception ex) {
            Mod.Log.ErrorRecoverable(ex);
        }
    }

    /// <summary>
    /// Snapshot of the latest screenshot.
    /// Stores the state of the current screenshot and accompanying info that we
    /// don't want to update in real-time after the screenshot is taken (other
    /// info like city name and username have their own separated binding as
    /// we want to allow the user to change them on the fly).
    /// Serialized to JSON for displaying in the UI.
    /// </summary>
    private sealed class ScreenshotSnapshot(
        int achievedMilestone,
        int population,
        IReadOnlyCollection<byte> imageBytes,
        Vector2Int imageSize) : IJsonWritable {
        /// <summary>
        /// As we use the same file name for each new screenshot, this is a
        /// refresh counter appended to the URL of the image as a query
        /// parameter for cache busting.
        /// </summary>
        private static int latestVersion;

        private readonly int currentVersion =
            ScreenshotSnapshot.latestVersion++;

        public void Write(IJsonWriter writer) {
            writer.TypeBegin(this.GetType().FullName);

            writer.PropertyName("achievedMilestone");
            writer.Write(achievedMilestone);

            writer.PropertyName("population");
            writer.Write(population);

            writer.PropertyName("imageUri");
            writer.Write(
                $"coui://halloffame/screenshot.jpg?v={this.currentVersion}");

            writer.PropertyName("imageWidth");
            writer.Write(imageSize.x);

            writer.PropertyName("imageHeight");
            writer.Write(imageSize.y);

            writer.PropertyName("imageFileSize");
            writer.Write(imageBytes.Count);

            writer.TypeEnd();
        }
    }
}
