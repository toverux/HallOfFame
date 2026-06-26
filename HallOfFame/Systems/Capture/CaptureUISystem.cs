using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Colossal.Core;
using Colossal.Serialization.Entities;
using Colossal.UI.Binding;
using Game;
using Game.City;
using Game.SceneFlow;
using Game.UI;
using Game.UI.InGame;
using Game.UI.Localization;
using Game.UI.Menu;
using HallOfFame.Http;
using HallOfFame.Reflection;
using HallOfFame.Services;
using HallOfFame.Utils;
using Unity.Entities;
using UnityEngine;
using ValueType = cohtml.Net.ValueType;

namespace HallOfFame.Systems.Capture;

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

  private CitySnapshotProvider citySnapshotProvider = null!;

  private ImagePreloaderUISystem? imagePreloaderUISystem;

  /// <summary>
  /// Asset mods list for the dropdown allowing to pick a showcased mod.
  /// It is lazily hydrated once in <see cref="DoTakeScreenshot"/> when a screenshot is first taken,
  /// before the upload panel is presented.
  /// </summary>
  private ValueBinding<Colossal.PSI.Common.Mod[]?> assetModsBinding = null!;

  private GetterValueBinding<string> cityNameBinding = null!;

  private GetterValueBinding<ScreenshotSnapshot?> screenshotSnapshotBinding =
    null!;

  private GetterValueBinding<UploadProgress?> uploadProgressBinding = null!;

  private TriggerBinding takeScreenshotBinding = null!;

  private TriggerBinding clearScreenshotBinding = null!;

  private TriggerBinding<ScreenshotInfoFormValue> uploadScreenshotBinding = null!;

  /// <summary>
  /// Current screenshot snapshot.
  /// Null if no screenshot is being displayed/uploaded.
  /// </summary>
  private ScreenshotSnapshot? CurrentScreenshot {
    get => this.currentScreenshotValue;
    set {
      this.currentScreenshotValue = value;

      this.uploadProgressModel = null;

      // Optimization: only enable live bindings when a screenshot is being displayed/uploaded.
      // Run on the next frame to let the UI update one last time.
      MainThreadDispatcher.RegisterUpdater(() => { this.Enabled = value is not null; });
    }
  }

  /// <summary>
  /// Backing field for <see cref="CurrentScreenshot"/>.
  /// </summary>
  private ScreenshotSnapshot? currentScreenshotValue;

  /// <summary>
  /// Progress model for the current upload, or <c>null</c> when no upload is in progress.
  /// </summary>
  private UploadProgressModel? uploadProgressModel;

  protected override void OnCreate() {
    base.OnCreate();

    try {
      // Re-enabled when there is an active screenshot.
      this.Enabled = false;

      this.imagePreloaderUISystem = this.World.GetOrCreateSystemManaged<ImagePreloaderUISystem>();

      // The query is created here so its lifetime stays system-managed.
      var milestoneLevelQuery = this.GetEntityQuery(ComponentType.ReadOnly<MilestoneLevel>());

      this.citySnapshotProvider = new CitySnapshotProvider(this.World, milestoneLevelQuery);

      this.assetModsBinding = new ValueBinding<Colossal.PSI.Common.Mod[]?>(
        CaptureUISystem.BindingGroup,
        "assetMods",
        null,
        new ListWriter<Colossal.PSI.Common.Mod>(new ModValueWriter()).Nullable()
      );

      this.cityNameBinding = new GetterValueBinding<string>(
        CaptureUISystem.BindingGroup,
        "cityName",
        this.citySnapshotProvider.GetCityName
      );

      this.screenshotSnapshotBinding =
        new GetterValueBinding<ScreenshotSnapshot?>(
          CaptureUISystem.BindingGroup,
          "screenshotSnapshot",
          () => this.CurrentScreenshot,
          new ValueWriter<ScreenshotSnapshot>().Nullable()
        );

      this.uploadProgressBinding =
        new GetterValueBinding<UploadProgress?>(
          CaptureUISystem.BindingGroup,
          "uploadProgress",
          () => this.uploadProgressModel?.Current,
          new ValueWriter<UploadProgress>().Nullable()
        );

      this.takeScreenshotBinding = new TriggerBinding(
        CaptureUISystem.BindingGroup,
        "takeScreenshot",
        this.TakeScreenshot
      );

      this.clearScreenshotBinding = new TriggerBinding(
        CaptureUISystem.BindingGroup,
        "clearScreenshot",
        this.ClearScreenshot
      );

      this.uploadScreenshotBinding = new TriggerBinding<ScreenshotInfoFormValue>(
        CaptureUISystem.BindingGroup,
        "uploadScreenshot",
        this.UploadScreenshot
      );

      this.AddBinding(this.assetModsBinding);
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
    GameMode mode
  ) {
    // Clear cache when the game state changes, so ex. if a user leaves to Paradox Mods and installs
    // a mod, it will be picked up if they reopen a save just after.
    this.citySnapshotProvider.InvalidateModsCache();

    if (this.CurrentScreenshot is not null) {
      // Clear the screenshot when the game state changes, for example, when the user exits to the
      // main menu. Otherwise, the screenshot dialog would appear when the user reopens a game.
      this.ClearScreenshot();
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
      Mod.Log.ErrorRecoverable(ex);

      this.CurrentScreenshot = null;
    }
  }

  private async Task DoTakeScreenshot() {
    CaptureUISystem.PlaySound("select-item");

    var captured = await ScreenshotCapturer.Capture();

    // Prepare full size and preview images in a background thread.
    await Task.Run(() => {
        File.WriteAllBytes(CaptureUISystem.ScreenshotPreviewFilePath, captured.JpgPreviewBytes);
        File.WriteAllBytes(CaptureUISystem.ScreenshotFilePath, captured.PngBytes);

        CaptureUISystem.WriteLocalScreenshot(captured.PngBytes);
      }
    );

    // Collect playset.
    var mods = await this.citySnapshotProvider.GetActiveMods();
    var modIds = mods.Select(mod => mod.id).ToArray();

    // If the asset mods value binding is not set yet, initialize it.
    if (this.assetModsBinding.value is null) {
      var assetMods = mods
        .Where(mod => mod.tags.Contains("Prefab") || mod.tags.Contains("Map"))
        .OrderBy(mod => mod.displayName)
        .ToArray();

      this.assetModsBinding.Update(assetMods);
    }

    var screenshotSnapshot = new ScreenshotSnapshot(
      this.citySnapshotProvider.GetAchievedMilestone(),
      this.citySnapshotProvider.GetPopulation(),
      this.citySnapshotProvider.GetMapName(),
      captured.PngBytes,
      captured.Size,
      captured.WasGlobalIlluminationDisabled,
      captured.AreSettingsTopQuality,
      this.citySnapshotProvider.GetPhotoModePropertiesSnapshot(),
      modIds
    );

    // Preload the preview image in the cache before updating the UI.
    await this.imagePreloaderUISystem!.Preload(screenshotSnapshot.PreviewImageUri);

    this.CurrentScreenshot = screenshotSnapshot;

    CaptureUISystem.PlaySound("take-photo");
  }

  private void ClearScreenshot() {
    if (this.CurrentScreenshot is null) {
      Mod.Log.Warn($"Game: Call to {nameof(this.ClearScreenshot)} with no active screenshot.");

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
  private async void UploadScreenshot(ScreenshotInfoFormValue formValue) {
    if (this.CurrentScreenshot is null) {
      Mod.Log.Warn($"Game: Call to {nameof(this.ClearScreenshot)} with no active screenshot.");

      return;
    }

    this.World.GetOrCreateSystemManaged<CommonUISystem>()
      .SaveScreenshotPreferences(
        formValue.ShareModIds,
        formValue.ShareRenderSettings,
        formValue.Description
      );

    CancellationTokenSource? processingUpdatesCts = null;

    // Capture a non-null reference to this upload's model: the field can be cleared concurrently
    // (e.g., by clearing the screenshot), but the callback and the ramp must keep driving this same
    // instance, which the UI binding reads back through the field.
    var progressModel = this.uploadProgressModel = new UploadProgressModel();

    try {
      var screenshot = await Mod.Api.UploadScreenshot(
        new UploadScreenshotParams {
          CityName = this.citySnapshotProvider.GetCityName(),
          CityMilestone = this.CurrentScreenshot.Value.AchievedMilestone,
          CityPopulation = this.CurrentScreenshot.Value.Population,
          MapName = this.CurrentScreenshot.Value.MapName,
          ShowcasedModId = formValue.ShowcasedModId,
          Description = formValue.Description,
          ShareModIds = formValue.ShareModIds,
          ModIds = this.CurrentScreenshot.Value.ModIds,
          ShareRenderSettings = formValue.ShareRenderSettings,
          RenderSettings = this.CurrentScreenshot.Value.RenderSettings,
          ScreenshotData = this.CurrentScreenshot.Value.ImageBytes,
          UploadProgressHandler = (upload, download) => {
            progressModel.ReportUploadProgress(upload);

            // Once the request body is fully sent, start the time-based processing progress ramp.
            // The guard ensures it is started only once, as the callback keeps firing afterward.
            if (progressModel.IsProcessing && processingUpdatesCts is null) {
              processingUpdatesCts = new CancellationTokenSource();

              _ = StartUpdateProcessingProgress(processingUpdatesCts.Token);
            }
          }
        }
      );

      progressModel.Complete();

      Mod.Log.Info($"{nameof(CaptureUISystem)}: Screenshot uploaded, ID #{screenshot.Id}.");
    }
    catch (HttpException ex) {
      // Reset progress state.
      this.uploadProgressModel = null;

      ErrorDialogManagerAccessor.Instance?.ShowError(
        new ErrorDialog {
          localizedTitle = "HallOfFame.Systems.CaptureUI.UPLOAD_ERROR",
          localizedMessage = ex.GetUserFriendlyMessage(),
          actions = ErrorDialog.ActionBits.Continue
        }
      );
    }
    catch (Exception ex) {
      // Reset progress state.
      this.uploadProgressModel = null;

      Mod.Log.ErrorRecoverable(ex);
    }
    finally {
      processingUpdatesCts?.Cancel();
    }

    return;

    async Task StartUpdateProcessingProgress(CancellationToken ct) {
      var startTime = DateTime.Now;

      while (!ct.IsCancellationRequested) {
        var elapsedSeconds = (float)(DateTime.Now - startTime).TotalSeconds;

        progressModel.ReportProcessingElapsed(elapsedSeconds);

        // The model caps the processing guess; once reached, the ramp has nothing left to do and
        // stops by itself (it is also canceled when the upload completes or errors).
        if (progressModel.HasReachedProcessingCap) {
          break;
        }

        await Task.Yield();
      }
    }
  }

  /// <summary>
  /// Checks if the user has set a creator name in the mod settings, if not, a dialog will be shown
  /// to prompt the user to set one and direct them to the settings.
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
      LocalizedString.IdWithFallback("Common.ACTION[Cancel]", "Cancel")
    );

    GameManager.instance.userInterface.appBindings
      .ShowConfirmationDialog(dialog, OnConfirmOrCancel);

    return true;

    void OnConfirmOrCancel(int choice) {
      if (choice is not 0) {
        return;
      }

      var gamePanelUISystem = this.World.GetOrCreateSystemManaged<GamePanelUISystem>();
      var optionsUISystem = this.World.GetOrCreateSystemManaged<OptionsUISystem>();

      gamePanelUISystem.ClosePanel(typeof(PhotoModePanel).FullName);

      optionsUISystem.OpenPage(
        "HallOfFame.HallOfFame.Mod",
        "HallOfFame.HallOfFame.Mod.General",
        false
      );
    }
  }

  /// <summary>
  /// Play a sound.
  /// </summary>
  private static void PlaySound(string sound) {
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
  private static void WriteLocalScreenshot(byte[] pngScreenshotBytes) {
    if (!Mod.Settings.CreateLocalScreenshot) {
      return;
    }

    // We will mimic the vanilla screenshot naming scheme.
    // The game uses a ScreenUtility class, which increments a private counter we read through our
    // proxy, and we should use the same naming scheme.
    var fileName = Path.Combine(
      Mod.GameScreenshotsPath,
      $"{DateTime.Now:dd-MMMM-HH-mm-ss}-{ScreenUtilityProxy.Count++:00}.png"
    );

    File.WriteAllBytes(fileName, pngScreenshotBytes);
  }

  /// <summary>
  /// Snapshot of the latest screenshot.
  /// Stores the state of the current screenshot and accompanying info that we don't want to update
  /// in real-time after the screenshot is taken. Other info like city name and username have their
  /// own separated binding as we want to allow the user to change them on the fly after the
  /// screenshot is taken.
  /// Serializable to JSON for displaying in the UI.
  /// </summary>
  private readonly struct ScreenshotSnapshot(
    int achievedMilestone,
    int population,
    string? mapName,
    byte[] imageBytes,
    Vector2Int imageSize,
    bool wasGlobalIlluminationDisabled,
    bool areSettingsTopQuality,
    IDictionary<string, float> renderSettings,
    string[] modIds
  ) : IJsonWritable {
    /// <summary>
    /// As we use the same file name for each new screenshot, this is a refresh counter appended to
    /// the URL of the image as a query parameter for cache busting.
    /// </summary>
    private static int latestVersion;

    private readonly int currentVersion = ScreenshotSnapshot.latestVersion++;

    internal int AchievedMilestone { get; } = achievedMilestone;

    internal int Population { get; } = population;

    internal string? MapName { get; } = mapName;

    internal byte[] ImageBytes { get; } = imageBytes;

    internal IDictionary<string, float> RenderSettings { get; } =
      renderSettings;

    internal string[] ModIds { get; } = modIds;

    internal string PreviewImageUri =>
      $"coui://halloffame/{Path.GetFileName(CaptureUISystem.ScreenshotPreviewFilePath)}" +
      $"?v={this.currentVersion}";

    private string ImageUri =>
      $"coui://halloffame/{Path.GetFileName(CaptureUISystem.ScreenshotFilePath)}" +
      $"?v={this.currentVersion}";

    public void Write(IJsonWriter writer) {
      writer.TypeBegin(this.GetType().FullName);

      writer.PropertyName("mapName");
      writer.Write(this.MapName);

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

  // ReSharper disable once ClassNeverInstantiated.Local
  private sealed record ScreenshotInfoFormValue : IJsonReadable {
    internal bool ShareModIds;

    internal bool ShareRenderSettings;

    internal string? ShowcasedModId;

    internal string? Description;

    public void Read(IJsonReader reader) {
      reader.ReadMapBegin();

      reader.ReadProperty("shareModIds");
      reader.Read(out this.ShareModIds);

      reader.ReadProperty("shareRenderSettings");
      reader.Read(out this.ShareRenderSettings);

      reader.ReadProperty("showcasedModId");

      var showcasedModIdValueType = reader.PeekValueType();

      if (showcasedModIdValueType is ValueType.Null) {
        reader.SkipValue();
      }
      else {
        reader.Read(out string showcasedModId);
        this.ShowcasedModId = showcasedModId;
      }

      reader.ReadProperty("description");
      reader.Read(out this.Description);

      reader.ReadMapEnd();
    }
  }
}
