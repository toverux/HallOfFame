using System;
using System.IO;
using System.Linq;
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
using HallOfFame.Reflection;
using HallOfFame.Services;
using HallOfFame.Utils;
using HallOfFame.Utils.Writers;
using Unity.Entities;

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
    Path.Combine(Mod.ModDataPath, ScreenshotSnapshot.ScreenshotFileName);

  /// <summary>
  /// File path for the preview of the latest screenshot taken.
  /// For file-serving purposes only.
  /// </summary>
  private static readonly string ScreenshotPreviewFilePath =
    Path.Combine(Mod.ModDataPath, ScreenshotSnapshot.ScreenshotPreviewFileName);

  private CitySnapshotProvider citySnapshotProvider = null!;

  private ScreenshotUploader screenshotUploader = null!;

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

  /// <summary>
  /// Surfaces the user's saved upload-form choices to the UI so the panel can restore them when it
  /// reopens.
  /// Manually updated (not an update binding) on each upload, see <see cref="UploadScreenshot"/>.
  /// </summary>
  private GetterValueBinding<UploadFormMemory> uploadFormMemoryBinding = null!;

  private TriggerBinding takeScreenshotBinding = null!;

  private TriggerBinding clearScreenshotBinding = null!;

  private TriggerBinding<ScreenshotInfoFormValue> uploadScreenshotBinding = null!;

  /// <summary>
  /// Current screenshot snapshot.
  /// Null if no screenshot is being displayed/uploaded.
  /// </summary>
  private ScreenshotSnapshot? CurrentScreenshot {
    get;
    set {
      field = value;

      this.screenshotUploader.Reset();

      // Optimization: only enable live bindings when a screenshot is being displayed/uploaded.
      // Run on the next frame to let the UI update one last time.
      MainThreadDispatcher.RegisterUpdater(() => { this.Enabled = value is not null; });
    }
  }

  protected override void OnCreate() {
    base.OnCreate();

    try {
      // Re-enabled when there is an active screenshot.
      this.Enabled = false;

      // The query is created here so its lifetime stays system-managed.
      var milestoneLevelQuery = this.GetEntityQuery(ComponentType.ReadOnly<MilestoneLevel>());

      this.citySnapshotProvider = new CitySnapshotProvider(this.World, milestoneLevelQuery);

      // The uploader owns the capture -> assemble -> upload -> progress workflow, reporting back
      // through callbacks so this system keeps owning the UI binding and the (engine-bound) error
      // dialog.
      this.screenshotUploader = new ScreenshotUploader(
        Mod.Api,
        Mod.Log,
        ex => ErrorDialogManagerAccessor.Instance?.ShowError(
          new ErrorDialog {
            localizedTitle = "HallOfFame.Systems.CaptureUI.UPLOAD_ERROR",
            localizedMessage = ex.GetUserFriendlyMessage(),
            actions = ErrorDialog.ActionBits.Continue
          }
        )
      );

      this.assetModsBinding = new ValueBinding<Colossal.PSI.Common.Mod[]?>(
        CaptureUISystem.BindingGroup,
        "assetMods",
        null,
        new ListWriter<Colossal.PSI.Common.Mod>(new AssetModValueWriter()).Nullable()
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
          () => this.screenshotUploader.CurrentProgress,
          new ValueWriter<UploadProgress>().Nullable()
        );

      this.uploadFormMemoryBinding =
        new GetterValueBinding<UploadFormMemory>(
          CaptureUISystem.BindingGroup,
          "uploadFormMemory",
          () => new UploadFormMemory(
            Mod.Settings.SavedShareModIdsPreference,
            Mod.Settings.SavedShareRenderSettingsPreference,
            Mod.Settings.SavedScreenshotDescription
          )
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
      this.AddBinding(this.uploadFormMemoryBinding);
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
      captured.Size.x,
      captured.Size.y,
      captured.WasGlobalIlluminationDisabled,
      captured.AreSettingsTopQuality,
      this.citySnapshotProvider.GetPhotoModePropertiesSnapshot(),
      modIds
    );

    this.CurrentScreenshot = screenshotSnapshot;
  }

  private void ClearScreenshot() {
    if (this.CurrentScreenshot is null) {
      Mod.Log.Warn(
        $"{nameof(CaptureUISystem)}: Call to {nameof(this.ClearScreenshot)} with no active screenshot."
      );

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

  private void UploadScreenshot(ScreenshotInfoFormValue formValue) {
    if (this.CurrentScreenshot is null) {
      Mod.Log.Warn(
        $"{nameof(CaptureUISystem)}: Call to {nameof(this.UploadScreenshot)} with no active screenshot."
      );

      return;
    }

    // Remember the form choices so the panel can restore them the next time it opens.
    // We deliberately do NOT ApplyAndSave() here: the in-memory writing is enough (CS2 dumps
    // ModSetting properties to file on game close), and ApplyAndSave() would fire
    // onSettingsApplied, triggering a spurious creator UpdateMe server sync.
    // We refresh our own binding directly.
    Mod.Settings.SavedShareModIdsPreference = formValue.ShareModIds;
    Mod.Settings.SavedShareRenderSettingsPreference = formValue.ShareRenderSettings;
    Mod.Settings.SavedScreenshotDescription = formValue.Description;

    this.uploadFormMemoryBinding.Update();

    // The city name is read live at upload time (the user can edit it after the screenshot is
    // taken), unlike the rest of the snapshot which is frozen at capture.
    var cityName = this.citySnapshotProvider.GetCityName();

    // The uploader never throws and drives its own progress/error reporting, so fire-and-forget.
    _ = this.screenshotUploader.Upload(this.CurrentScreenshot.Value, cityName, formValue);
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
}
