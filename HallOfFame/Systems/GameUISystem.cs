using System;
using System.IO;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using Colossal.Serialization.Entities;
using Colossal.UI.Binding;
using Game;
using Game.City;
using Game.SceneFlow;
using Game.Simulation;
using Game.UI;
using Game.UI.InGame;
using Game.UI.Localization;
using Game.UI.Menu;
using HallOfFame.Http;
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
internal sealed partial class GameUISystem : UISystemBase {
    private const string BindingGroup = "hallOfFame.game";

    /// <summary>
    /// File path of the latest screenshot taken.
    /// For file-serving purposes only.
    /// </summary>
    private static readonly string ScreenshotFilePath =
        Path.Combine(Mod.ModDataPath, "screenshot.jpg");

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

    private GetterValueBinding<string> cityNameBinding = null!;

    private GetterValueBinding<ScreenshotSnapshot?> screenshotSnapshotBinding =
        null!;

    private GetterValueBinding<UploadProgress?> uploadProgressBinding = null!;

    private TriggerBinding takeScreenshotBinding = null!;

    private TriggerBinding clearScreenshotBinding = null!;

    private TriggerBinding uploadScreenshotBinding = null!;

    /// <summary>
    /// Current screenshot snapshot.
    /// Null if no screenshot is being displayed/uploaded.
    /// </summary>
    private ScreenshotSnapshot? CurrentScreenshot {
        get => this.currentScreenshotValue;
        set {
            this.currentScreenshotValue = value;

            this.uploadProgress = null;

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

    private UploadProgress? uploadProgress;

    protected override void OnCreate() {
        base.OnCreate();

        try {
            // Re-enabled when there is an active screenshot.
            this.Enabled = false;

            this.citySystem =
                this.World.GetOrCreateSystemManaged<CitySystem>();

            this.cityConfigurationSystem =
                this.World.GetOrCreateSystemManaged<CityConfigurationSystem>();

            this.photoModeUISystem =
                this.World.GetOrCreateSystemManaged<PhotoModeUISystem>();

            this.milestoneLevelQuery =
                this.GetEntityQuery(ComponentType.ReadOnly<MilestoneLevel>());

            this.cityNameBinding = new GetterValueBinding<string>(
                GameUISystem.BindingGroup, "cityName",
                this.GetCityName);

            this.screenshotSnapshotBinding =
                new GetterValueBinding<ScreenshotSnapshot?>(
                    GameUISystem.BindingGroup, "screenshotSnapshot",
                    () => this.CurrentScreenshot,
                    new ValueWriter<ScreenshotSnapshot>().Nullable());

            this.uploadProgressBinding =
                new GetterValueBinding<UploadProgress?>(
                    GameUISystem.BindingGroup, "uploadProgress",
                    () => this.uploadProgress,
                    new ValueWriter<UploadProgress>().Nullable());

            this.takeScreenshotBinding = new TriggerBinding(
                GameUISystem.BindingGroup, "takeScreenshot",
                this.BeginTakeScreenshot);

            this.clearScreenshotBinding = new TriggerBinding(
                GameUISystem.BindingGroup, "clearScreenshot",
                this.ClearScreenshot);

            this.uploadScreenshotBinding = new TriggerBinding(
                GameUISystem.BindingGroup, "uploadScreenshot",
                this.UploadScreenshot);

            this.AddUpdateBinding(this.cityNameBinding);
            this.AddUpdateBinding(this.screenshotSnapshotBinding);
            this.AddUpdateBinding(this.uploadProgressBinding);
            this.AddBinding(this.takeScreenshotBinding);
            this.AddBinding(this.clearScreenshotBinding);
            this.AddBinding(this.uploadScreenshotBinding);
        }
        catch (Exception ex) {
            Mod.Log.ErrorFatal(ex);
        }
    }

    protected override void OnGameLoadingComplete(
        Purpose purpose,
        GameMode mode) {
        if (this.CurrentScreenshot is not null) {
            // Clear the screenshot when the game state changes, ex. the user
            // exits to the main menu. Otherwise, the screenshot dialog would
            // appear when the user reopens a game.
            this.ClearScreenshot();
        }
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
            ? this.EntityManager
                .GetComponentData<Population>(this.citySystem.City)
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
        // Early exit if the user has not set a creator name.
        if (this.CheckShouldSetCreatorName()) {
            return;
        }

        PhotoModeUISystemPatch.OnCaptureScreenshot +=
            this.ContinueTakeScreenshot;

        // This is unlikely to break except if the Vanilla method changes
        // parameters signature, but we will make sure to handle that properly.
        // Note that this does not encapsulate ContinueTakeScreenshot() which
        // is executed in a coroutine, and has its own try/catch.
        try {
            GameUISystem.TakeScreenshotOriginalMethod.Invoke(
                this.photoModeUISystem, null);
        }
        catch (Exception ex) {
            Mod.Log.ErrorRecoverable(ex);

            PhotoModeUISystemPatch.OnCaptureScreenshot -=
                this.ContinueTakeScreenshot;
        }
    }

    /// <summary>
    /// Called back by our Harmony patch, just before Vanilla capture.
    /// </summary>
    /// <returns>
    /// A boolean indicating whether the Vanilla capture should proceed.
    /// </returns>
    private bool ContinueTakeScreenshot() {
        PhotoModeUISystemPatch.OnCaptureScreenshot -=
            this.ContinueTakeScreenshot;

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

            // Create a RenderTexture with the supersize resolution, and ask the
            // camera to render to it.
            var width = Screen.width * scaleFactor;
            var height = Screen.height * scaleFactor;
            var renderTexture = new RenderTexture(width, height, 24);

            Camera.main!.targetTexture = renderTexture;
            Camera.main.Render();

            // Now, read the RenderTexture to a Texture2D.
            RenderTexture.active = renderTexture;

            var screenshotTexture =
                new Texture2D(width, height, TextureFormat.RGB24, false);

            screenshotTexture.ReadPixels(new Rect(0, 0, width, height), 0, 0);
            screenshotTexture.Apply();

            // Reset the camera's target texture
            Camera.main.targetTexture = null;
            RenderTexture.active = null;

            // Encode the Texture2D to a JPG byte array.
            var screenshotBytes = screenshotTexture.EncodeToJPG();

            // Clean up the textures after usage.
            Object.DestroyImmediate(renderTexture);
            Object.DestroyImmediate(screenshotTexture);

            File.WriteAllBytes(
                GameUISystem.ScreenshotFilePath, screenshotBytes);

            this.CurrentScreenshot = new ScreenshotSnapshot(
                this.GetAchievedMilestone(),
                this.GetPopulation(),
                screenshotBytes,
                new Vector2Int(width, height));
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
                $"Game: Call to {nameof(this.ClearScreenshot)} " +
                $"with no active screenshot.");

            return;
        }

        try {
            File.Delete(GameUISystem.ScreenshotFilePath);
        }
        catch (Exception ex) {
            Mod.Log.ErrorRecoverable(ex);
        }
        finally {
            this.CurrentScreenshot = null;
        }
    }

    private async void UploadScreenshot() {
        if (this.CurrentScreenshot is null) {
            Mod.Log.Warn(
                $"Game: Call to {nameof(this.ClearScreenshot)} " +
                $"with no active screenshot.");

            return;
        }

        CancellationTokenSource? processingUpdatesCts = null;

        try {
            this.uploadProgress = new UploadProgress(0, 0);

            var screenshot = await HttpQueries.UploadScreenshot(
                this.GetCityName(),
                this.CurrentScreenshot.Value.AchievedMilestone,
                this.CurrentScreenshot.Value.Population,
                this.CurrentScreenshot.Value.ImageBytes,
                progressHandler: (upload, download) => {
                    // Case 1: The request is being sent.
                    if (upload < 1) {
                        // Set progress to the current upload progress.
                        this.uploadProgress = new UploadProgress(upload, 0);
                    }

                    // Case 2: The request has been sent and we are waiting for
                    // the response.
                    // The condition must ensure this runs only once.
                    else if (upload >= 1 && processingUpdatesCts is null) {
                        // Mark upload as done and start 'processing' progress.
                        // Processing progress is a guess, as of now the server
                        // does not stream back progress, so it is based on time
                        // elapsed.
                        this.uploadProgress = new UploadProgress(1, 0);

                        processingUpdatesCts = new CancellationTokenSource();

                        // This task will update the processing progress
                        // asynchronously until we cancel it, or it reaches 90%
                        // progress, then it will stop by itself.
                        _ = StartUpdateProcessingProgress(
                            processingUpdatesCts.Token);
                    }

                    // Case 3: The response has been fully received.
                    // This is handled in the rest of the method so we ensure
                    // the progress is set to 100% at the end.
                });

            // Set progress to done.
            this.uploadProgress = new UploadProgress(1, 1);

            Mod.Log.Info($"Game: Screenshot uploaded, ID #{screenshot.Id}.");
        }
        catch (HttpException ex) {
            // Reset progress state.
            this.uploadProgress = null;

            ErrorDialogManager.ShowErrorDialog(new ErrorDialog {
                localizedTitle = "HallOfFame.Systems.GameUI.UPLOAD_ERROR",
                localizedMessage = ex.GetUserFriendlyMessage(),
                actions = ErrorDialog.Actions.None
            });
        }
        catch (Exception ex) {
            // Reset progress state.
            this.uploadProgress = null;

            Mod.Log.ErrorRecoverable(ex);
        }
        finally {
            processingUpdatesCts?.Cancel();
        }

        return;

        async Task StartUpdateProcessingProgress(CancellationToken ct) {
            const float processingTimeSeconds = 3f;

            var startTime = DateTime.Now;

            while (!ct.IsCancellationRequested) {
                var elapsedSeconds =
                    (float)(DateTime.Now - startTime).TotalSeconds;

                var progress = Math.Min(
                    elapsedSeconds / processingTimeSeconds, .9f);

                this.uploadProgress = new UploadProgress(1, progress);

                if (progress >= .9f) {
                    break;
                }

                await Task.Yield();
            }
        }
    }

    /// <summary>
    /// Checks if the user has set a creator name in the mod settings, if not a
    /// dialog will be shown to prompt the user to set one and direct them to
    /// the settings.
    /// </summary>
    /// <returns>Whether the user must go set their Creator Name.</returns>
    private bool CheckShouldSetCreatorName() {
        if (!string.IsNullOrWhiteSpace(Mod.Settings.CreatorName)) {
            return false;
        }

        var dialog = new ConfirmationDialog(
            LocalizedString.IdWithFallback(
                "HallOfFame.Systems.GameUI.SET_CREATOR_NAME_DIALOG[Title]",
                "Choose a Creator Name"),
            LocalizedString.IdWithFallback(
                "HallOfFame.Systems.GameUI.SET_CREATOR_NAME_DIALOG[Message]",
                "To be able to upload a picture, you must first choose a Creator Name in the mod settings."),
            LocalizedString.IdWithFallback(
                "HallOfFame.Systems.GameUI.SET_CREATOR_NAME_DIALOG[ConfirmAction]",
                "Open Mod Settings"),
            LocalizedString.IdWithFallback(
                "Common.ACTION[Cancel]",
                "Cancel"));

        GameManager.instance.userInterface.appBindings
            .ShowConfirmationDialog(dialog, OnConfirmOrCancel);

        return true;

        void OnConfirmOrCancel(int choice) {
            if (choice is not 0) {
                return;
            }

            var gamePanelUISystem =
                this.World.GetOrCreateSystemManaged<GamePanelUISystem>();

            var optionsUISystem =
                this.World.GetOrCreateSystemManaged<OptionsUISystem>();

            gamePanelUISystem.ClosePanel(typeof(PhotoModePanel).FullName);

            optionsUISystem.OpenPage(
                "HallOfFame.HallOfFame.Mod",
                "HallOfFame.HallOfFame.Mod.General",
                false);
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
    private readonly struct ScreenshotSnapshot(
        int achievedMilestone,
        int population,
        byte[] imageBytes,
        Vector2Int imageSize) : IJsonWritable {
        /// <summary>
        /// As we use the same file name for each new screenshot, this is a
        /// refresh counter appended to the URL of the image as a query
        /// parameter for cache busting.
        /// </summary>
        private static int latestVersion;

        private readonly int currentVersion =
            ScreenshotSnapshot.latestVersion++;

        internal int AchievedMilestone { get; } = achievedMilestone;

        internal int Population { get; } = population;

        internal byte[] ImageBytes { get; } = imageBytes;

        public void Write(IJsonWriter writer) {
            writer.TypeBegin(this.GetType().FullName);

            writer.PropertyName("achievedMilestone");
            writer.Write(this.AchievedMilestone);

            writer.PropertyName("population");
            writer.Write(this.Population);

            writer.PropertyName("imageUri");

            writer.Write(
                $"coui://halloffame/screenshot.jpg?v={this.currentVersion}");

            writer.PropertyName("imageWidth");
            writer.Write(imageSize.x);

            writer.PropertyName("imageHeight");
            writer.Write(imageSize.y);

            writer.PropertyName("imageFileSize");
            writer.Write(this.ImageBytes.Length);

            writer.TypeEnd();
        }
    }

    private readonly struct UploadProgress(
        float uploadProgress,
        float processingProgress) : IJsonWritable {
        public void Write(IJsonWriter writer) {
            writer.TypeBegin(this.GetType().FullName);

            writer.PropertyName("isComplete");
            writer.Write(uploadProgress >= 1 && processingProgress >= 1);

            writer.PropertyName("globalProgress");
            writer.Write((uploadProgress + processingProgress) / 2);

            writer.PropertyName("uploadProgress");
            writer.Write(uploadProgress);

            writer.PropertyName("processingProgress");
            writer.Write(processingProgress);

            writer.TypeEnd();
        }
    }
}
