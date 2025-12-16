using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Colossal.Serialization.Entities;
using Colossal.UI.Binding;
using Game;
using Game.Input;
using Game.SceneFlow;
using Game.Settings;
using Game.UI;
using Game.UI.Localization;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Reflection;
using HallOfFame.Utils;
using UnityEngine.InputSystem;

namespace HallOfFame.Systems;

/// <summary>
/// System in charge of handling the presentation of community images and the various interactions
/// that come with it (next, prev, like, etc.).
/// </summary>
internal sealed partial class PresenterUISystem : UISystemBase {
  private const string BindingGroup = "hallOfFame.presenter";

  private ImagePreloaderUISystem imagePreloaderUISystem = null!;

  private bool forceEnableMainMenuSlideshow;

  private ProxyAction forceEnableMainMenuSlideshowAction = null!;

  private GetterValueBinding<bool> enableMainMenuSlideshowBinding = null!;

  private GetterValueBinding<bool> hasPreviousScreenshotBinding = null!;

  private ValueBinding<int> forcedRefreshIndexBinding = null!;

  private ValueBinding<bool> isRefreshingBinding = null!;

  private ValueBinding<Screenshot?> screenshotBinding = null!;

  private ValueBinding<LocalizedString?> errorBinding = null!;

  private ValueBinding<bool> isSavingBinding = null!;

  private InputActionBinding previousScreenshotInputActionBinding = null!;

  private InputActionBinding nextScreenshotInputActionBinding = null!;

  private InputActionBinding likeScreenshotInputActionBinding = null!;

  private InputActionBinding toggleMenuInputActionBinding = null!;

  private TriggerBinding previousScreenshotBinding = null!;

  private TriggerBinding nextScreenshotBinding = null!;

  private TriggerBinding likeScreenshotBinding = null!;

  private TriggerBinding saveScreenshotBinding = null!;

  private TriggerBinding reportScreenshotBinding = null!;

  private readonly IList<Screenshot> screenshotsQueue =
    new List<Screenshot>();

  private int currentScreenshotIndex = -1;

  /// <summary>
  /// Indicates the previous game mode to refresh the screenshot when the user returns to the main
  /// menu.
  /// Note: it is initialized with <see cref="GameMode.MainMenu"/> and not the default value, it is
  /// intentional.
  /// </summary>
  private GameMode previousGameMode = GameMode.MainMenu;

  private bool isTogglingLike;

  protected override void OnCreate() {
    base.OnCreate();

    try {
      // No need to OnUpdate as there are no bindings that require it, they are manually updated
      // when needed.
      this.Enabled = false;

      this.imagePreloaderUISystem =
        this.World.GetOrCreateSystemManaged<ImagePreloaderUISystem>();

      this.forceEnableMainMenuSlideshowAction =
        Mod.Settings.GetAction(nameof(Settings.KeyBindingForceEnableMainMenuSlideshow));

      // VALUE BINDINGS
      this.enableMainMenuSlideshowBinding = new GetterValueBinding<bool>(
        PresenterUISystem.BindingGroup,
        "enableMainMenuSlideshow",
        () => this.forceEnableMainMenuSlideshow || Mod.Settings.EnableMainMenuSlideshow
      );

      this.hasPreviousScreenshotBinding = new GetterValueBinding<bool>(
        PresenterUISystem.BindingGroup,
        "hasPreviousScreenshot",
        () => this.currentScreenshotIndex > 0
      );

      this.forcedRefreshIndexBinding = new ValueBinding<int>(
        PresenterUISystem.BindingGroup,
        "forcedRefreshIndex",
        1
      );

      this.isRefreshingBinding = new ValueBinding<bool>(
        PresenterUISystem.BindingGroup,
        "isRefreshing",
        false
      );

      this.screenshotBinding = new ValueBinding<Screenshot?>(
        PresenterUISystem.BindingGroup,
        "screenshot",
        null,
        new ValueWriter<Screenshot?>().Nullable()
      );

      this.errorBinding = new ValueBinding<LocalizedString?>(
        PresenterUISystem.BindingGroup,
        "error",
        null,
        new ValueWriter<LocalizedString>().Nullable()
      );

      this.isSavingBinding = new ValueBinding<bool>(
        PresenterUISystem.BindingGroup,
        "isSaving",
        false
      );

      this.AddBinding(this.enableMainMenuSlideshowBinding);
      this.AddBinding(this.hasPreviousScreenshotBinding);
      this.AddBinding(this.forcedRefreshIndexBinding);
      this.AddBinding(this.isRefreshingBinding);
      this.AddBinding(this.screenshotBinding);
      this.AddBinding(this.errorBinding);
      this.AddBinding(this.isSavingBinding);

      // INPUT ACTION BINDINGS
      this.previousScreenshotInputActionBinding = new InputActionBinding(
        PresenterUISystem.BindingGroup,
        "previousScreenshotInputAction",
        Mod.Settings.KeyBindingPrevious
      );

      this.nextScreenshotInputActionBinding = new InputActionBinding(
        PresenterUISystem.BindingGroup,
        "nextScreenshotInputAction",
        Mod.Settings.KeyBindingNext
      );

      this.likeScreenshotInputActionBinding = new InputActionBinding(
        PresenterUISystem.BindingGroup,
        "likeScreenshotInputAction",
        Mod.Settings.KeyBindingLike
      );

      this.toggleMenuInputActionBinding = new InputActionBinding(
        PresenterUISystem.BindingGroup,
        "toggleMenuInputAction",
        Mod.Settings.KeyBindingToggleMenu
      );

      this.AddBinding(this.previousScreenshotInputActionBinding);
      this.AddBinding(this.nextScreenshotInputActionBinding);
      this.AddBinding(this.likeScreenshotInputActionBinding);
      this.AddBinding(this.toggleMenuInputActionBinding);

      // TRIGGER BINDINGS
      this.previousScreenshotBinding = new TriggerBinding(
        PresenterUISystem.BindingGroup,
        "previousScreenshot",
        this.PreviousScreenshot
      );

      this.nextScreenshotBinding = new TriggerBinding(
        PresenterUISystem.BindingGroup,
        "nextScreenshot",
        this.NextScreenshot
      );

      this.likeScreenshotBinding = new TriggerBinding(
        PresenterUISystem.BindingGroup,
        "likeScreenshot",
        this.LikeScreenshot
      );

      this.saveScreenshotBinding = new TriggerBinding(
        PresenterUISystem.BindingGroup,
        "saveScreenshot",
        this.SaveScreenshot
      );

      this.reportScreenshotBinding = new TriggerBinding(
        PresenterUISystem.BindingGroup,
        "reportScreenshot",
        this.ReportScreenshot
      );

      this.AddBinding(this.previousScreenshotBinding);
      this.AddBinding(this.nextScreenshotBinding);
      this.AddBinding(this.likeScreenshotBinding);
      this.AddBinding(this.saveScreenshotBinding);
      this.AddBinding(this.reportScreenshotBinding);

      // Wire force-enable main menu slideshow.
      Mod.Settings.onSettingsApplied += this.OnSettingsApplied;

      this.forceEnableMainMenuSlideshowAction.onInteraction +=
        this.OnForceEnableMainMenuSlideshowInteraction;

      this.EnableOrDisableEnableMainMenuSlideshowAction();
    }
    catch (Exception ex) {
      Mod.Log.ErrorFatal(ex);
    }
  }

  protected override void OnDestroy() {
    base.OnDestroy();

    Mod.Settings.onSettingsApplied -= this.OnSettingsApplied;

    this.forceEnableMainMenuSlideshowAction.onInteraction -=
      this.OnForceEnableMainMenuSlideshowInteraction;
  }

  /// <summary>
  /// Lifecycle method used for changing the current screenshot when the user returns to the main
  /// menu.
  /// </summary>
  protected override void OnGameLoadingComplete(Purpose purpose, GameMode mode) {
    // The condition serves two purposes:
    // 1. Call NextScreenshot when the user returns to the main menu from another game mode.
    // 2. Avoid potentially repeating the NextScreenshot call when the game boots and mods are
    //    initialized before the first game mode is set, this rarely happens, but it's possible.
    //    Note: in later versions of the game, this seems extremely unlikely in normal setups.
    if (mode is GameMode.MainMenu && this.previousGameMode is not GameMode.MainMenu) {
      this.forcedRefreshIndexBinding.Update(this.forcedRefreshIndexBinding.value + 1);
    }

    this.previousGameMode = mode;

    this.EnableOrDisableEnableMainMenuSlideshowAction();
  }

#if DEBUG
  /// <summary>
  /// Debug/development method to load a screenshot by its ID.
  /// Does not use the queue system.
  /// </summary>
  internal async void LoadScreenshotById(string screenshotId) {
    try {
      this.isRefreshingBinding.Update(true);

      var screenshot = await HttpQueries.GetScreenshot(screenshotId);

      screenshot = await this.LoadScreenshot(screenshot: screenshot, preload: false);

      if (screenshot is not null) {
        this.screenshotBinding.Update(screenshot);
      }
    }
    catch (Exception ex) {
      Mod.Log.ErrorRecoverable(ex);
    }
    finally {
      this.isRefreshingBinding.Update(false);
    }
  }
#endif

  private void OnSettingsApplied(Setting _) {
    this.enableMainMenuSlideshowBinding.Update();
    this.EnableOrDisableEnableMainMenuSlideshowAction();
  }

  private void OnForceEnableMainMenuSlideshowInteraction(ProxyAction _, InputActionPhase phase) {
    if (phase is InputActionPhase.Performed) {
      this.forceEnableMainMenuSlideshow ^= true;
      this.enableMainMenuSlideshowBinding.Update();
    }
  }

  private void EnableOrDisableEnableMainMenuSlideshowAction() {
    this.forceEnableMainMenuSlideshowAction.shouldBeEnabled =
      Mod.Settings.EnableMainMenuSlideshow is false &&
      GameManager.instance.gameMode is GameMode.MainMenu;
  }

  /// <summary>
  /// Switches the current screenshot to the previous if there is one
  /// (<see cref="screenshotsQueue"/>).
  /// The method is `async void` because it is designed to be called in a fire-and-forget manner,
  /// and it must be designed to never throw.
  /// </summary>
  // ReSharper disable once AsyncVoidMethod
  private async void PreviousScreenshot() {
    if (this.isRefreshingBinding.value) {
      return;
    }

    if (this.currentScreenshotIndex <= 0) {
      Mod.Log.ErrorSilent(
        $"Menu: {nameof(this.PreviousScreenshot)}: " +
        $"Cannot go back, already at the first screenshot."
      );

      return;
    }

    this.isRefreshingBinding.Update(true);

    var screenshot = this.screenshotsQueue[--this.currentScreenshotIndex];

    // We still need to make sure the image is preloaded, because these images aren't kept long in
    // cohtml's cache; if the user clicks 'Previous' a few times, this is necessary.
    screenshot = await this.LoadScreenshot(screenshot: screenshot, preload: false);

    // There was an error when preloading the previous image.
    if (screenshot is not null) {
      this.screenshotBinding.Update(screenshot);
      this.hasPreviousScreenshotBinding.Update();
    }

    Mod.Log.Verbose(
      $"{nameof(PresenterUISystem)}: {nameof(this.PreviousScreenshot)}: Displaying {screenshot} " +
      $"(queue idx {this.currentScreenshotIndex}/" +
      $"{this.screenshotsQueue.Count - 1})."
    );

    this.isRefreshingBinding.Update(false);
  }

  /// <summary>
  /// Switches the current screenshot to the next if there is one (<see cref="screenshotsQueue"/>),
  /// otherwise it loads a new one.
  /// Then it preloads the next screenshot again in the background.
  /// The method is `async void` because it is designed to be called in a fire-and-forget manner,
  /// and it should be designed to never throw.
  /// </summary>
  // ReSharper disable once AsyncVoidMethod
  private async void NextScreenshot() {
    if (this.isRefreshingBinding.value) {
      return;
    }

    this.isRefreshingBinding.Update(true);

    Screenshot? screenshot;

    // If there is a preloaded screenshot next in the queue, set it as the current screenshot.
    // This happens when the user first clicks "Next".
    if (this.screenshotsQueue.Count - 1 > this.currentScreenshotIndex) {
      screenshot = this.screenshotsQueue[++this.currentScreenshotIndex];
    }

    // Otherwise, load a new screenshot, add it to the queue, and set it as the current screenshot.
    // This happens when the first image is loaded, or when there was an error preloading the next
    // image in the previous NextScreenshot call.
    else {
      screenshot = await this.LoadScreenshot(false);

      if (screenshot is not null) {
        this.screenshotsQueue.Add(screenshot);
        this.currentScreenshotIndex++;
      }
    }

    // There was an error, don't preload the next image, but leave the previous screenshot
    // displayed. Reset the refresh state.
    // The error binding is already updated by LoadScreenshot().
    if (screenshot is null) {
      this.isRefreshingBinding.Update(false);

      return;
    }

    // The screenshot was successfully loaded, update the screenshot being displayed and
    // asynchronously preload the next one.
    this.screenshotBinding.Update(screenshot);
    this.hasPreviousScreenshotBinding.Update();

    Mod.Log.Verbose(
      $"{nameof(PresenterUISystem)}: {nameof(this.NextScreenshot)}: Displaying {screenshot} " +
      $"(queue idx {this.currentScreenshotIndex}/" +
      $"{this.screenshotsQueue.Count - 1})."
    );

    if (this.currentScreenshotIndex < this.screenshotsQueue.Count - 1) {
      // If we are not at the end of the queue (the user clicked previous once or more), we're done
      // as we have the next screenshots in stock, so we don't have to preload the next one.
      this.isRefreshingBinding.Update(false);
    }
    else {
      // If we are viewing the last screenshot in the queue, prepare the next one in the background.
      PreloadNextScreenshot();
      // It also means the current screenshot was just viewed.
      MarkViewed();
    }

    return;

    // Fire-and-forget async method that should be designed to never throw.
    // ReSharper disable once AsyncVoidMethod
    async void PreloadNextScreenshot() {
      // Variable used below to avoid infinite loops when there is only one screenshot in the
      // database (that can happen during development).
#if DEBUG
      var iterations = 0;
#endif

      Screenshot? nextScreenshot;

      // The loop is a workaround to avoid loading the same screenshot twice if the server returns
      // the same screenshot twice (or more).
      // This should be extremely rare, only happening in dev mode with a small number of
      // screenshots and the random algorithm without views taken into account because all
      // screenshots have been seen.
      // The check is cheap, and it's more complex to implement server-side, so let's do that here.
      do {
        nextScreenshot = await this.LoadScreenshot(true);
      } while (
#if DEBUG
        iterations++ < 20 &&
#endif
        nextScreenshot is not null &&
        nextScreenshot.Id ==
        this.screenshotBinding.value?.Id);

      if (nextScreenshot is not null) {
        this.screenshotsQueue.Add(nextScreenshot);

        // Trim queue if it's more than 20 screenshots long.
        if (this.screenshotsQueue.Count > 20) {
          this.screenshotsQueue.RemoveAt(0);
          this.currentScreenshotIndex--; // Adjust index.
        }
      }

      // Release the refresh lock.
      // If any code above is susceptible to throw, ensure this is called
      // inside a finally block.
      this.isRefreshingBinding.Update(false);
    }

    // Fire-and-forget async method that should be designed to never throw.
    async void MarkViewed() {
      try {
        await HttpQueries.MarkScreenshotViewed(screenshot.Id);
      }
      catch (Exception ex) {
        Mod.Log.ErrorSilent(ex);
      }
    }
  }

  /// <summary>
  /// Loads a new screenshot from the server and preloads the image in the UI, also is responsible
  /// to handle all errors.
  /// </summary>
  /// <param name="preload">
  /// If true, network errors will be logged, but not displayed, as it is a non-critical background
  /// operation.<br/>
  /// It is the responsibility of the caller to handle the fact that the preloading failed, and, for
  /// example, retry a classic loading operation the next time the user refreshes the image.
  /// </param>
  /// <param name="screenshot">
  /// The screenshot to preload, if null, a new one will be fetched from the server.
  /// </param>
  /// <returns>
  /// A <see cref="Screenshot"/> if the API call *and* image were successful, null if there was an
  /// error.
  /// </returns>
  private async Task<Screenshot?> LoadScreenshot(
    bool preload,
    Screenshot? screenshot = null
  ) {
    try {
      screenshot ??= await HttpQueries.GetRandomScreenshotWeighted();

      var imageUrl = Mod.Settings.ScreenshotResolution switch {
        "fhd" => screenshot.ImageUrlFHD,
        "4k" => screenshot.ImageUrl4K,
        var resolution => throw new InvalidOperationException(
          $"Unknown screenshot resolution: {resolution}."
        )
      };

      await this.imagePreloaderUISystem.Preload(imageUrl);

      if (!preload) {
        this.errorBinding.Update(null);
      }

      Mod.Log.Verbose(
        $"{nameof(PresenterUISystem)}: {(preload ? "Preloaded" : "Loaded")} {screenshot} " +
        $"({imageUrl}, algo={screenshot.Algorithm})."
      );

      return screenshot;
    }
    catch (Exception ex) when (preload) {
      Mod.Log.ErrorSilent(ex);

      return null;
    }
    catch (Exception ex) when (this.IsNetworkError(ex)) {
      this.errorBinding.Update(ex.GetUserFriendlyMessage());

      return null;
    }
    catch (Exception ex) {
      Mod.Log.ErrorRecoverable(ex);

      return null;
    }
  }

  /// <summary>
  /// Toggle the liked status of the current screenshot, with an optimistic UI update.
  /// The method is `async void` because it is designed to be called in a fire-and-forget manner,
  /// and it should be designed to never throw.
  /// </summary>
  // ReSharper disable once AsyncVoidMethod
  private async void LikeScreenshot() {
    if (this.isTogglingLike ||
        this.isRefreshingBinding.value ||
        this.screenshotBinding.value is null) {
      return;
    }

    this.isTogglingLike = true;

    var prevScreenshot = this.screenshotBinding.value;

    var updatedScreenshot = prevScreenshot with {
      IsLiked = !prevScreenshot.IsLiked,
      LikesCount = prevScreenshot.LikesCount + (prevScreenshot.IsLiked ? -1 : 1)
    };

    // Replace the current screenshot with the liked one.
    this.screenshotsQueue[this.currentScreenshotIndex] = updatedScreenshot;
    this.screenshotBinding.Update(updatedScreenshot);

    try {
      await HttpQueries.LikeScreenshot(
        updatedScreenshot.Id,
        updatedScreenshot.IsLiked
      );
    }
    catch (HttpException ex) {
      ErrorDialogManagerAccessor.Instance?.ShowError(
        new ErrorDialog {
          localizedTitle = "HallOfFame.Common.OOPS",
          localizedMessage = ex.GetUserFriendlyMessage(),
          actions = ErrorDialog.ActionBits.Continue
        }
      );

      // Revert the optimistic UI update.
      this.screenshotsQueue[this.currentScreenshotIndex] = prevScreenshot;
      this.screenshotBinding.Update(prevScreenshot);
    }
    catch (Exception ex) {
      Mod.Log.ErrorRecoverable(ex);
    }
    finally {
      this.isTogglingLike = false;
    }
  }

  /// <summary>
  /// Saves the current screenshot 4K image to the disk, to the path specified in the mod settings.
  /// The method is `async void` because it is designed to be called in a fire-and-forget manner,
  /// and it should be designed to never throw.
  /// </summary>
  // ReSharper disable once AsyncVoidMethod
  private async void SaveScreenshot() {
    var screenshot = this.screenshotBinding.value;

    if (this.isSavingBinding.value || screenshot is null) {
      return;
    }

    try {
      this.isSavingBinding.Update(true);

      var imageBytes = await HttpQueries.DownloadImage(screenshot.ImageUrl4K);

      var directory = Mod.Settings.CreatorsScreenshotSaveDirectory;

      var filePath = Path.Combine(
        Mod.Settings.CreatorsScreenshotSaveDirectory,
        $"{screenshot.Creator?.CreatorName} - " +
        $"{screenshot.CityName} - " +
        $"{screenshot.CreatedAt.ToLocalTime():yyyy.MM.dd HH.mm.ss}.jpg"
      );

      await Task.Run(() => {
          Directory.CreateDirectory(directory);
          File.WriteAllBytes(filePath, imageBytes);
        }
      );

      Mod.Log.Info($"{nameof(PresenterUISystem)}: Saved {screenshot} image to {filePath}.");
    }
    catch (Exception ex) when (this.IsNetworkError(ex)) {
      Mod.Log.Error(ex.GetUserFriendlyMessage());
    }
    catch (Exception ex) {
      Mod.Log.ErrorRecoverable(ex);
    }
    finally {
      this.isSavingBinding.Update(false);
    }
  }

  private void ReportScreenshot() {
    var screenshot = this.screenshotBinding.value;

    if (screenshot is null) {
      throw new ArgumentNullException(nameof(this.screenshotBinding));
    }

    var dialog = new ConfirmationDialog(
      new LocalizedString(
        "HallOfFame.Systems.PresenterUI.CONFIRM_REPORT_DIALOG[Title]",
        "Report screenshot {CITY_NAME} by {AUTHOR_NAME}?",
        new Dictionary<string, ILocElement> {
          { "CITY_NAME", LocalizedString.Value(screenshot.CityName) },
          { "AUTHOR_NAME", LocalizedString.Value(screenshot.Creator?.CreatorName) }
        }
      ),
      LocalizedString.Id("HallOfFame.Systems.PresenterUI.CONFIRM_REPORT_DIALOG[Message]"),
      LocalizedString.Id("HallOfFame.Systems.PresenterUI.CONFIRM_REPORT_DIALOG[ConfirmAction]"),
      LocalizedString.IdWithFallback("Common.ACTION[Cancel]", "Cancel")
    );

    GameManager.instance.userInterface.appBindings
      .ShowConfirmationDialog(dialog, OnConfirmOrCancel);

    return;

    async void OnConfirmOrCancel(int choice) {
      try {
        if (choice is not 0) {
          return;
        }

        await HttpQueries.ReportScreenshot(screenshot.Id);

        var successDialog = new MessageDialog(
          LocalizedString.Id("HallOfFame.Systems.PresenterUI.REPORT_SUCCESS_DIALOG[Title]"),
          LocalizedString.Id("HallOfFame.Systems.PresenterUI.REPORT_SUCCESS_DIALOG[Message]"),
          LocalizedString.IdWithFallback("Common.CLOSE", "Close")
        );

        GameManager.instance.userInterface.appBindings
          .ShowMessageDialog(successDialog, _ => { });

        this.forcedRefreshIndexBinding.Update(this.forcedRefreshIndexBinding.value + 1);
      }
      catch (HttpException ex) {
        ErrorDialogManagerAccessor.Instance?.ShowError(
          new ErrorDialog {
            localizedTitle = "HallOfFame.Common.OOPS",
            localizedMessage = ex.GetUserFriendlyMessage(),
            actions = ErrorDialog.ActionBits.Continue
          }
        );
      }
      catch (Exception ex) {
        Mod.Log.ErrorRecoverable(ex);
      }
    }
  }

  private bool IsNetworkError(Exception ex) {
    return ex
      is HttpException
      or ImagePreloaderUISystem.ImagePreloadFailedException;
  }
}
