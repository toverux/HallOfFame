using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Colossal.PSI.Common;
using Colossal.PSI.PdxSdk;
using Colossal.Serialization.Entities;
using Colossal.UI.Binding;
using Game;
using Game.City;
using Game.Rendering;
using Game.SceneFlow;
using Game.Settings;
using Game.Simulation;
using Game.UI;
using Game.UI.InGame;
using Game.UI.Localization;
using Game.UI.Menu;
using HallOfFame.Http;
using HallOfFame.Reflection;
using HallOfFame.Utils;
using Unity.Entities;
using UnityEngine;
using UnityEngine.Rendering.HighDefinition;
using Object = UnityEngine.Object;

namespace HallOfFame.Systems;

/// <summary>
/// UI System responsible for taking and uploading screenshots.
/// </summary>
internal sealed partial class CaptureUISystem : UISystemBase {
  private const string BindingGroup = "hallOfFame.capture";

  /// <summary>
  /// File path of the latest screenshot taken.
  /// For file-serving purposes only.
  /// </summary>
  private static readonly string ScreenshotFilePath =
    Path.Combine(Mod.ModDataPath, "screenshot.jpg");

  /// <summary>
  /// File path for the preview of the latest screenshot taken.
  /// For file-serving purposes only.
  /// </summary>
  private static readonly string ScreenshotPreviewFilePath =
    Path.Combine(Mod.ModDataPath, "preview.jpg");

  private CitySystem? citySystem;

  private CityConfigurationSystem? cityConfigurationSystem;

  private PhotoModeRenderSystem? photoModeRenderSystem;

  private ImagePreloaderUISystem? imagePreloaderUISystem;

  private EntityQuery milestoneLevelQuery;

  private GetterValueBinding<string> cityNameBinding = null!;

  private GetterValueBinding<ScreenshotSnapshot?> screenshotSnapshotBinding =
    null!;

  private GetterValueBinding<UploadProgress?> uploadProgressBinding = null!;

  private TriggerBinding takeScreenshotBinding = null!;

  private TriggerBinding clearScreenshotBinding = null!;

  private TriggerBinding uploadScreenshotBinding = null!;

  private int[]? activeModIdsCache;

  /// <summary>
  /// Current screenshot snapshot.
  /// Null if no screenshot is being displayed/uploaded.
  /// </summary>
  private ScreenshotSnapshot? CurrentScreenshot {
    get => this.currentScreenshotValue;
    set {
      this.currentScreenshotValue = value;

      this.uploadProgress = null;

      // Optimization: only enable live bindings when a screenshot is being displayed/uploaded.
      // Run on the next frame to let the UI update one last time.
      GameManager.instance.RegisterUpdater(() => { this.Enabled = value is not null; });
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

      this.photoModeRenderSystem =
        this.World.GetOrCreateSystemManaged<PhotoModeRenderSystem>();

      this.imagePreloaderUISystem =
        this.World.GetOrCreateSystemManaged<ImagePreloaderUISystem>();

      this.milestoneLevelQuery =
        this.GetEntityQuery(ComponentType.ReadOnly<MilestoneLevel>());

      this.cityNameBinding = new GetterValueBinding<string>(
        CaptureUISystem.BindingGroup, "cityName",
        this.GetCityName);

      this.screenshotSnapshotBinding =
        new GetterValueBinding<ScreenshotSnapshot?>(
          CaptureUISystem.BindingGroup, "screenshotSnapshot",
          () => this.CurrentScreenshot,
          new ValueWriter<ScreenshotSnapshot>().Nullable());

      this.uploadProgressBinding =
        new GetterValueBinding<UploadProgress?>(
          CaptureUISystem.BindingGroup, "uploadProgress",
          () => this.uploadProgress,
          new ValueWriter<UploadProgress>().Nullable());

      this.takeScreenshotBinding = new TriggerBinding(
        CaptureUISystem.BindingGroup, "takeScreenshot",
        this.TakeScreenshot);

      this.clearScreenshotBinding = new TriggerBinding(
        CaptureUISystem.BindingGroup, "clearScreenshot",
        this.ClearScreenshot);

      this.uploadScreenshotBinding = new TriggerBinding(
        CaptureUISystem.BindingGroup, "uploadScreenshot",
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
      // Clear the screenshot when the game state changes, for example, when the user exits to the
      // main menu. Otherwise, the screenshot dialog would appear when the user reopens a game.
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
  /// Get the Paradox Mods IDs for the enabled mods.
  /// </summary>
  private async Task<int[]> GetActiveModIds() {
    if (this.activeModIdsCache is not null) {
      return this.activeModIdsCache;
    }

    try {
      var pdxSdk =
        PlatformManager.instance.GetPSI<PdxSdkPlatform>("PdxSdk");

      // This will return null if the player is not logged in or in other error cases.
      var mods = await pdxSdk.GetModsInActivePlayset() ?? [];

      return this.activeModIdsCache = mods
        .Select(mod => mod.id)
        // Ignore Hall of Fame's ID
        .Where(id => id != 90641)
        .ToArray();
    }
    catch (Exception ex) {
      Mod.Log.ErrorRecoverable(ex);

      return [];
    }
  }

  /// <summary>
  /// Saves the values used by the photo mode render system to a dictionary of property ID => value
  /// (always a float).
  /// That is enough info to restore them later!
  /// </summary>
  private IDictionary<string, float> GetPhotoModePropertiesSnapshot() {
    try {
      if (this.photoModeRenderSystem is null) {
        return new Dictionary<string, float>();
      }

      return this.photoModeRenderSystem.photoModeProperties.Values
        .Where(prop =>
          prop.getValue is not null &&
          prop.isEnabled is not null &&
          prop.isEnabled())
        .ToDictionary(prop => prop.id, prop => prop.getValue());
    }
    catch (Exception ex) {
      Mod.Log.ErrorRecoverable(ex);

      return new Dictionary<string, float>();
    }
  }

  /// <summary>
  /// Take a screenshot and prepare it for upload.
  /// If the user has not set a creator name, a dialog will be shown to prompt the user to set one
  /// and the method will not proceed.
  /// </summary>
  private async void TakeScreenshot() {
    // This bricks the current game session if this throws, so we will handle exceptions properly
    // here, as there is a non-zero chance of failure in this section (notably due to I/O).
    try {
      // Early exit if the user has not set a creator name.
      if (this.CheckShouldSetCreatorName()) {
        return;
      }

      await this.DoTakeScreenshot();
    }
    catch (Exception ex) {
      GameManager.instance.userInterface.view.enabled = true;

      Mod.Log.ErrorRecoverable(ex);

      this.CurrentScreenshot = null;
    }
  }

  private async Task DoTakeScreenshot() {
    this.PlaySound("select-item");

    // Hide the UI, otherwise it will be captured in the screenshot.
    GameManager.instance.userInterface.view.enabled = false;
    await Task.Yield();

    // Take a supersize screenshot that is *at least* 2160 pixels (4K).
    // Height is better than width because of widescreen monitors.
    // The server will decide the final resolution, i.e., rescale to 2160p if the resulting image is
    // bigger.
    var scaleFactor = (int)Math.Ceiling(2160d / Screen.height);

    var camera = Camera.main!;

    // Disable DLSS, causes grainy pictures or artifacts with some setups, also we already do actual
    // supersampling.
    var cameraData = camera.GetComponent<HDAdditionalCameraData>();
    var previousDlssValue = cameraData.allowDeepLearningSuperSampling;
    cameraData.allowDeepLearningSuperSampling = false;

    // Disable Unity dynamic resolution upscaling, it's a low-quality profile.
    var dynResSettings = SharedSettings.instance.graphics
      .GetQualitySetting<DynamicResolutionScaleSettings>();

    var previousDynResLevel = dynResSettings.GetLevel();

    if (dynResSettings.GetLevel() != QualitySetting.Level.High) {
      // "High" actually means "Disabled" as disabling this option yields the best quality.
      dynResSettings.SetLevel(QualitySetting.Level.High, apply: false);
      dynResSettings.Apply();
    }

    // Disable global illumination as it causes a LOT of grain in CS2's implementation of GI, on
    // most NVIDIA GPUs.
    var globalIllumination = SharedSettings.instance.graphics
      .GetVolumeOverride<GlobalIllumination>();

    var previousGIValue = globalIllumination.enable.value;

    if (Mod.Settings.DisableGlobalIllumination) {
      globalIllumination.enable.Override(false);
    }

    // Let time for some graphics settings to apply.
    // When testing, only DynamicResolutionScaleSettings needed this, but in any case it's not a bad
    // idea.
    await Task.Yield();

    // Create a RenderTexture with the supersize resolution and ask the camera to render to it.
    var width = Screen.width * scaleFactor;
    var height = Screen.height * scaleFactor;
    var renderTexture = new RenderTexture(width, height, 24);

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

    var screenshotTexture =
      new Texture2D(width, height, TextureFormat.RGB24, false);

    screenshotTexture.ReadPixels(new Rect(0, 0, width, height), 0, 0);
    screenshotTexture.Apply();

    // Reset DLSS
    cameraData.allowDeepLearningSuperSampling = previousDlssValue;

    // Reset dynamic resolution
    if (dynResSettings.GetLevel() != previousDynResLevel) {
      dynResSettings.SetLevel(previousDynResLevel, apply: false);
      dynResSettings.Apply();
    }

    // Reset GI
    if (Mod.Settings.DisableGlobalIllumination) {
      globalIllumination.enable.Override(previousGIValue);
    }

    // Reset the camera's target texture
    camera.targetTexture = null;
    RenderTexture.active = null;

    // Re-enable the UI.
    GameManager.instance.userInterface.view.enabled = true;
    await Task.Yield();

    // Encode the Texture2D to a PNG byte array.
    // Note: image encoding cannot be done in a background thread because Unity requires it to be
    // done on the main thread.
    var pngScreenshotBytes = screenshotTexture.EncodeToPNG();

    // Create a light preview image.
    var previewTexture = this.Resize(
      screenshotTexture, Screen.width / 2, Screen.height / 2);

    var jpgPreviewBytes = previewTexture.EncodeToJPG(quality: 80);

    // Clean up the textures after usage.
    Object.DestroyImmediate(renderTexture);
    Object.DestroyImmediate(screenshotTexture);
    Object.DestroyImmediate(previewTexture);

    // Prepare full size and preview images in a background thread.
    await Task.Run(() => {
      File.WriteAllBytes(
        CaptureUISystem.ScreenshotPreviewFilePath, jpgPreviewBytes);

      File.WriteAllBytes(
        CaptureUISystem.ScreenshotFilePath, pngScreenshotBytes);

      this.WriteLocalScreenshot(pngScreenshotBytes);
    });

    var screenshotSnapshot = new ScreenshotSnapshot(
      achievedMilestone: this.GetAchievedMilestone(),
      population: this.GetPopulation(),
      imageBytes: pngScreenshotBytes,
      imageSize: new Vector2Int(width, height),
      wasGlobalIlluminationDisabled:
      previousGIValue && Mod.Settings.DisableGlobalIllumination,
      areSettingsTopQuality: this.AreSettingsTopQuality(),
      renderSettings: this.GetPhotoModePropertiesSnapshot(),
      modIds: await this.GetActiveModIds());

    // Preload the preview image in the cache before updating the UI.
    await this.imagePreloaderUISystem!
      .Preload(screenshotSnapshot.PreviewImageUri);

    this.CurrentScreenshot = screenshotSnapshot;

    this.PlaySound("take-photo");
  }

  private void ClearScreenshot() {
    if (this.CurrentScreenshot is null) {
      Mod.Log.Warn(
        $"Game: Call to {nameof(this.ClearScreenshot)} " +
        $"with no active screenshot.");

      return;
    }

    try {
      File.Delete(CaptureUISystem.ScreenshotFilePath);
      File.Delete(CaptureUISystem.ScreenshotPreviewFilePath);
    }
    catch (Exception ex) {
      Mod.Log.ErrorRecoverable(ex);
    }
    finally {
      this.CurrentScreenshot = null;
    }
  }

  // ReSharper disable once AsyncVoidMethod
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
        this.CurrentScreenshot.Value.ModIds,
        this.CurrentScreenshot.Value.RenderSettings,
        this.CurrentScreenshot.Value.ImageBytes,
        progressHandler: (upload, download) => {
          // Case 1: The request is being sent.
          if (upload < 1) {
            // Set progress to the current upload progress.
            this.uploadProgress = new UploadProgress(upload, 0);
          }

          // Case 2: The request has been sent, and we are waiting for the response.
          // The condition must ensure this runs only once.
          else if (upload >= 1 && processingUpdatesCts is null) {
            // Mark upload as done and start 'processing' progress.
            // Processing progress is a guess, as of now the server does not stream back progress,
            // so it is based on time elapsed.
            this.uploadProgress = new UploadProgress(1, 0);

            processingUpdatesCts = new CancellationTokenSource();

            // This task will update the processing progress asynchronously until we cancel it, or
            // it reaches 90% progress, then it will stop by itself.
            _ = StartUpdateProcessingProgress(
              processingUpdatesCts.Token);
          }

          // Case 3: The response has been fully received.
          // This is handled in the rest of the method, so we ensure the progress is set to 100% at
          // the end.
        });

      // Set progress to done.
      this.uploadProgress = new UploadProgress(1, 1);

      Mod.Log.Info($"{nameof(CaptureUISystem)}: Screenshot uploaded, ID #{screenshot.Id}.");
    }
    catch (HttpException ex) {
      // Reset progress state.
      this.uploadProgress = null;

      ErrorDialogManagerAccessor.Instance?.ShowError(new ErrorDialog {
        localizedTitle = "HallOfFame.Systems.CaptureUI.UPLOAD_ERROR",
        localizedMessage = ex.GetUserFriendlyMessage(),
        actions = ErrorDialog.ActionBits.Continue
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
      const float processingTimeSeconds = 8f;

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
      LocalizedString.Id("HallOfFame.Systems.CaptureUI.SET_CREATOR_NAME_DIALOG[Title]"),
      LocalizedString.Id("HallOfFame.Systems.CaptureUI.SET_CREATOR_NAME_DIALOG[Message]"),
      LocalizedString.Id("HallOfFame.Systems.CaptureUI.SET_CREATOR_NAME_DIALOG[ConfirmAction]"),
      LocalizedString.IdWithFallback("Common.ACTION[Cancel]", "Cancel"));

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

  /// <summary>
  /// Verifies that all graphics settings are set to the highest possible quality.
  /// Ignores Global Illumination and Dynamic Resolution Scale settings as they are overridden
  /// during the screenshot process because they cause issues.
  /// </summary>
  private bool AreSettingsTopQuality() => SharedSettings.instance.graphics
    .qualitySettings
    .Where(settings => settings
      is not SSGIQualitySettings
      and not DynamicResolutionScaleSettings)
    .All(settings => {
      var highestLevel = settings
        .EnumerateAvailableLevels()
        .Last(level => level != QualitySetting.Level.Custom);

      return settings.GetLevel() >= highestLevel;
    });

  /// <summary>
  /// Play a sound.
  /// </summary>
  private void PlaySound(string sound) {
    try {
      // ReSharper disable once Unity.UnknownResource
      var sounds = Resources.Load<UISoundCollection>("Audio/UI Sounds");
      sounds.PlaySound(sound);
    }
    catch (Exception ex) {
      Mod.Log.ErrorSilent(ex, $"Could not play sound {sound}.");
    }
  }

  /// <summary>
  /// Write the screenshot to the local screenshot directory, if enabled.
  /// It mimics the vanilla screenshot naming scheme.
  /// </summary>
  private void WriteLocalScreenshot(byte[] pngScreenshotBytes) {
    if (!Mod.Settings.CreateLocalScreenshot) {
      return;
    }

    // We will mimic the vanilla screenshot naming scheme.
    // The game uses a ScreenUtility class, which increments a private counter we read through our
    // proxy, and we should use the same naming scheme.
    var fileName = Path.Combine(
      Mod.GameScreenshotsPath,
      $"{DateTime.Now:dd-MMMM-HH-mm-ss}-{ScreenUtilityProxy.Count++:00}.png");

    File.WriteAllBytes(fileName, pngScreenshotBytes);
  }

  /// <summary>
  /// Resize a Texture2D to a new width and height.
  /// </summary>
  private Texture2D Resize(Texture2D texture2D, int width, int height) {
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
  /// Snapshot of the latest screenshot.
  /// Stores the state of the current screenshot and accompanying info that we don't want to update
  /// in real-time after the screenshot is taken (other info like city name and username have their
  /// own separated binding as we want to allow the user to change them on the fly).
  /// Serialized to JSON for displaying in the UI.
  /// </summary>
  private readonly struct ScreenshotSnapshot(
    int achievedMilestone,
    int population,
    byte[] imageBytes,
    Vector2Int imageSize,
    bool wasGlobalIlluminationDisabled,
    bool areSettingsTopQuality,
    IDictionary<string, float> renderSettings,
    int[] modIds) : IJsonWritable {
    /// <summary>
    /// As we use the same file name for each new screenshot, this is a refresh counter appended to
    /// the URL of the image as a query parameter for cache busting.
    /// </summary>
    private static int latestVersion;

    private readonly int currentVersion =
      ScreenshotSnapshot.latestVersion++;

    internal int AchievedMilestone { get; } = achievedMilestone;

    internal int Population { get; } = population;

    internal byte[] ImageBytes { get; } = imageBytes;

    internal IDictionary<string, float> RenderSettings { get; } =
      renderSettings;

    internal int[] ModIds { get; } = modIds;

    internal string PreviewImageUri =>
      $"coui://halloffame/{Path.GetFileName(CaptureUISystem.ScreenshotPreviewFilePath)}" +
      $"?v={this.currentVersion}";

    private string ImageUri =>
      $"coui://halloffame/{Path.GetFileName(CaptureUISystem.ScreenshotFilePath)}" +
      $"?v={this.currentVersion}";

    public void Write(IJsonWriter writer) {
      writer.TypeBegin(this.GetType().FullName);

      writer.PropertyName("achievedMilestone");
      writer.Write(this.AchievedMilestone);

      writer.PropertyName("population");
      writer.Write(this.Population);

      writer.PropertyName("previewImageUri");
      writer.Write(this.PreviewImageUri);

      writer.PropertyName("imageUri");
      writer.Write(this.ImageUri);

      writer.PropertyName("imageWidth");
      writer.Write(imageSize.x);

      writer.PropertyName("imageHeight");
      writer.Write(imageSize.y);

      writer.PropertyName("imageFileSize");
      writer.Write(this.ImageBytes.Length);

      writer.PropertyName("wasGlobalIlluminationDisabled");
      writer.Write(wasGlobalIlluminationDisabled);

      writer.PropertyName("areSettingsTopQuality");
      writer.Write(areSettingsTopQuality);

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
