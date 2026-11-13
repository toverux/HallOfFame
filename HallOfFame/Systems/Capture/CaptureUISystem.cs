using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
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
using Object = UnityEngine.Object;
#if DEBUG
using UnityEngine;
#endif

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

  private CapturePreviewTextures previewTextures = null!;

  private CitySnapshotProvider citySnapshotProvider = null!;

  private RenderConditionsReader renderConditionsReader = null!;

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

  private TriggerBinding openUploadedInDashboardBinding = null!;

  /// <summary>
  /// Whether a capture runs, from the press to its full image written, or to its encode finished
  /// once its snapshot is cleared, during which <see cref="TakeScreenshot"/> ignores a press.
  /// </summary>
  private bool isCaptureInFlight;

  #if DEBUG
  /// <summary>
  /// Set by <see cref="DebugCapture()"/>, cleared by the update that takes the screenshot.
  /// </summary>
  private bool isDebugCaptureScheduled;
  #endif

  /// <summary>
  /// Current screenshot snapshot.
  /// Null if no screenshot is being displayed/uploaded.
  /// </summary>
  private ScreenshotSnapshot? CurrentScreenshot {
    get;
    set {
      // A capture whose full image becomes ready keeps its upload: one may already wait for it.
      var isSameCapture = value is {} next && field is {} previous && next.IsSameCapture(previous);

      field = value;

      if (!isSameCapture) {
        this.screenshotUploader.Reset();
      }

      // Optimization: live bindings poll only while a screenshot is displayed or uploading.
      // Each change gets one update to publish it; OnUpdate disables the system once it is null.
      this.Enabled = true;
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

      this.renderConditionsReader = new RenderConditionsReader(this.World);

      this.previewTextures = new CapturePreviewTextures();

      // Kept alive by its subscription to the game's panel event.
      _ = new ClimateVolumeUnfreezer(this.World);

      // The uploader owns the capture -> assemble -> upload -> progress workflow, reporting back
      // through callbacks so this system keeps owning the UI binding and the (engine-bound) error
      // dialog.
      this.screenshotUploader = new ScreenshotUploader(
        Mod.Api,
        Mod.Log,
        ex => ErrorMessageDialog.Show(
          ex.GetUserFriendlyMessage(),
          "HallOfFame.Systems.CaptureUI.UPLOAD_ERROR"
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

      this.openUploadedInDashboardBinding = new TriggerBinding(
        CaptureUISystem.BindingGroup,
        "openUploadedInDashboard",
        this.OpenUploadedInDashboard
      );

      this.AddBinding(this.assetModsBinding);
      this.AddUpdateBinding(this.cityNameBinding);
      this.AddUpdateBinding(this.screenshotSnapshotBinding);
      this.AddUpdateBinding(this.uploadProgressBinding);
      this.AddBinding(this.uploadFormMemoryBinding);
      this.AddBinding(this.takeScreenshotBinding);
      this.AddBinding(this.clearScreenshotBinding);
      this.AddBinding(this.uploadScreenshotBinding);
      this.AddBinding(this.openUploadedInDashboardBinding);
    }
    catch (Exception ex) {
      Mod.Log.ErrorFatal(ex);
    }
  }

  protected override void OnDestroy() {
    this.previewTextures.Dispose();

    base.OnDestroy();
  }

  protected override void OnUpdate() {
    base.OnUpdate();

    #if DEBUG
    if (this.isDebugCaptureScheduled) {
      this.isDebugCaptureScheduled = false;

      this.TakeScreenshot();

      // The capture has read the override by now, as it runs synchronously up to that read, and a
      // capture that stopped before it, at the creator name check, must not pass it on to the next.
      CaptureDebugProbe.RenderSizeOverride = null;
    }
    #endif

    // Disabling here lets this update publish the cleared screenshot first; a disable deferred
    // through MainThreadDispatcher runs at the end of the frame (GameManager.Update), so a clear
    // landing after this update would turn the system off unpublished, the panel staying on screen.
    if (this.CurrentScreenshot is null) {
      this.Enabled = false;
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

  #if DEBUG
  /// <summary>
  /// Debug entry point: takes a screenshot as the Hall of Fame button does, and returns at once.
  /// The capture runs from this system's next update, a safe point in the frame: the eval can land
  /// inside the render pipeline's own render, where a render of ours crashes the game.
  /// Read <c>CaptureDebugProbe.LastReport.ToString()</c> once the report is no longer null: the
  /// eval shows a record by its type alone.
  /// </summary>
  internal static void DebugCapture() {
    CaptureUISystem.ScheduleDebugCapture(null);
  }

  /// <summary>
  /// Debug entry point: as <see cref="DebugCapture()"/>, rendering at the given size instead of the
  /// planned one.
  /// </summary>
  internal static void DebugCapture(int width, int height) {
    CaptureUISystem.ScheduleDebugCapture(new Vector2Int(width, height));
  }

  private static void ScheduleDebugCapture(Vector2Int? renderSize) {
    var system = World.DefaultGameObjectInjectionWorld.GetExistingSystemManaged<CaptureUISystem>();

    CaptureDebugProbe.RenderSizeOverride = renderSize;
    CaptureDebugProbe.LastReport = null;

    system.isDebugCaptureScheduled = true;
    system.Enabled = true;
  }
  #endif

  /// <summary>
  /// Take a screenshot and prepare it for upload.
  /// If the user has not set a creator name, a dialog will be shown to prompt the user to set one
  /// and the method will not proceed.
  /// </summary>
  private async void TakeScreenshot() {
    // One press, one screenshot: a press while a capture is in flight starts nothing, so it is not
    // tracked either.
    if (this.isCaptureInFlight) {
      return;
    }

    // Tracked before anything can stop it: the capture funnel starts at the press, which nothing
    // else records, since the upload panel shows only once a capture succeeded.
    Mod.UsageTracker.Track("capture_requested");

    this.isCaptureInFlight = true;

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

      // Clears the panel, open on the preview when the full image failed to encode.
      if (this.CurrentScreenshot is not null) {
        this.ClearScreenshot();
      }
    }
    finally {
      this.isCaptureInFlight = false;
    }
  }

  /// <summary>
  /// Captures, opens the upload panel on the preview, then writes the full image once encoded,
  /// returning only then.
  /// </summary>
  private async Task DoTakeScreenshot() {
    var captured = await ScreenshotCapturer.Capture(this.renderConditionsReader);

    // A capture taken while the panel shows an earlier one replaces it, and its files with it: the
    // earlier full image would otherwise outlive this capture if this one is cleared before its own
    // is written.
    if (this.CurrentScreenshot is not null) {
      this.ClearScreenshot();
    }

    ScreenshotSnapshot screenshotSnapshot;

    try {
      screenshotSnapshot = await this.CreateSnapshot(captured);
    }
    catch {
      Object.DestroyImmediate(captured.PreviewTexture);

      throw;
    }

    this.previewTextures.Serve(captured.PreviewTexture, screenshotSnapshot.PreviewTextureName);

    this.CurrentScreenshot = screenshotSnapshot;

    Mod.UsageTracker.Track("screenshot_captured");

    await this.WriteFullImage(screenshotSnapshot);
  }

  /// <summary>
  /// Describes <paramref name="captured"/> and the city it shows, the playset included.
  /// </summary>
  private async Task<ScreenshotSnapshot> CreateSnapshot(CapturedScreenshot captured) {
    // Collect playset.
    var mods = await this.citySnapshotProvider.GetActiveMods();
    var modIds = mods?.Select(mod => mod.id).ToArray();

    // If the asset mods value binding is not set yet, initialize it, unless the playset could not
    // be read, so that the next capture tries again.
    if (mods is not null && this.assetModsBinding.value is null) {
      this.assetModsBinding.Update(CitySnapshotProvider.SelectAssetMods(mods));
    }

    return new ScreenshotSnapshot(
      this.citySnapshotProvider.GetAchievedMilestone(),
      this.citySnapshotProvider.GetPopulation(),
      this.citySnapshotProvider.GetMapName(),
      captured.PngBytes,
      captured.Size.x,
      captured.Size.y,
      captured.WasGlobalIlluminationDisabled,
      captured.AreSettingsTopQuality,
      this.citySnapshotProvider.GetPhotoModePropertiesSnapshot(),
      captured.RenderConditions,
      modIds
    );
  }

  /// <summary>
  /// Writes the full image of <paramref name="snapshot"/> once encoded, and marks it ready.
  /// A capture discarded meanwhile (closed panel, game load) writes nothing, and deletes what it
  /// wrote if discarded during the write: the file names are shared by every capture.
  /// A failed encode throws, unless the capture is discarded by then, which only logs it.
  /// </summary>
  private async Task WriteFullImage(ScreenshotSnapshot snapshot) {
    byte[] pngBytes;

    try {
      pngBytes = await snapshot.ImageBytes;
    }
    catch (Exception ex) when (!this.IsCaptureKept(snapshot)) {
      Mod.Log.ErrorSilent(ex, $"{nameof(CaptureUISystem)}: A discarded capture failed to encode.");

      return;
    }

    if (!this.IsCaptureKept(snapshot)) {
      return;
    }

    var localScreenshotPath = await Task.Run(() => {
        File.WriteAllBytes(CaptureUISystem.ScreenshotFilePath, pngBytes);

        return CaptureUISystem.WriteLocalScreenshot(pngBytes);
      }
    );

    if (!this.IsCaptureKept(snapshot)) {
      File.Delete(CaptureUISystem.ScreenshotFilePath);

      if (localScreenshotPath is not null) {
        File.Delete(localScreenshotPath);
      }

      return;
    }

    this.CurrentScreenshot = snapshot with {
      ImageFileSize = pngBytes.Length
    };
  }

  /// <summary>
  /// Whether <paramref name="snapshot"/>'s capture is still on screen, and no game load started
  /// since: the snapshot is cleared only once a load completes, and the encode can end before.
  /// </summary>
  private bool IsCaptureKept(ScreenshotSnapshot snapshot) =>
    this.CurrentScreenshot is {} current &&
    current.IsSameCapture(snapshot) &&
    !GameManager.instance.isGameLoading;

  private void ClearScreenshot() {
    if (this.CurrentScreenshot is null) {
      Mod.Log.Warn(
        $"{nameof(CaptureUISystem)}: Call to {nameof(this.ClearScreenshot)} with no active screenshot."
      );

      return;
    }

    this.previewTextures.Retire(this.CurrentScreenshot.Value.PreviewTextureName);

    try {
      // Before its full image is ready, the capture deletes the file itself if it is being written,
      // see WriteFullImage: a delete here could collide with the write.
      if (this.CurrentScreenshot.Value.ImageFileSize is not null) {
        File.Delete(CaptureUISystem.ScreenshotFilePath);
      }
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

    Mod.UsageTracker.Track("upload_started");

    // The uploader never throws and drives its own progress/error reporting, so fire-and-forget.
    _ = this.screenshotUploader.Upload(this.CurrentScreenshot.Value, cityName, formValue);
  }

  /// <summary>
  /// Closes the upload panel for the dashboard, open on the screenshot the upload just created.
  /// </summary>
  private void OpenUploadedInDashboard() {
    var screenshotId = this.screenshotUploader.UploadedScreenshotId;

    this.ClearScreenshot();

    if (screenshotId is null) {
      Mod.Log.Warn(
        $"{nameof(CaptureUISystem)}: Call to {nameof(this.OpenUploadedInDashboard)} with no uploaded screenshot."
      );

      return;
    }

    this.World.GetOrCreateSystemManaged<DashboardUISystem>().OpenOnScreenshot(screenshotId);
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
  /// <returns>The path of the file written, null when disabled.</returns>
  private static string? WriteLocalScreenshot(byte[] pngScreenshotBytes) {
    if (!Mod.Settings.CreateLocalScreenshot) {
      return null;
    }

    // We will mimic the vanilla screenshot naming scheme.
    // The game uses a ScreenUtility class, which increments a private counter we read through our
    // proxy, and we should use the same naming scheme.
    var fileName = Path.Combine(
      Mod.GameScreenshotsPath,
      $"{DateTime.Now:dd-MMMM-HH-mm-ss}-{ScreenUtilityProxy.Count++:00}.png"
    );

    File.WriteAllBytes(fileName, pngScreenshotBytes);

    return fileName;
  }
}
