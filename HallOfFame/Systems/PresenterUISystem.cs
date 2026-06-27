using System;
using System.Collections.Generic;
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
using HallOfFame.Services;
using HallOfFame.Utils;
using HallOfFame.Utils.Writers;
using UnityEngine.InputSystem;

namespace HallOfFame.Systems;

/// <summary>
/// System in charge of handling the presentation of community images and the various interactions
/// that come with it (next, prev, like, etc.).
/// </summary>
internal sealed partial class PresenterUISystem : UISystemBase {
  private const string BindingGroup = "hallOfFame.presenter";

  private ScreenshotCarousel screenshotCarousel = null!;

  private ScreenshotExporter screenshotExporter = null!;

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

      // The carousel owns the screenshot window and all loading; this system only drives it and
      // mirrors the result onto the bindings. The resolution is read lazily, per load.
      this.screenshotCarousel = new ScreenshotCarousel(
        Mod.Api,
        this.World.GetOrCreateSystemManaged<ImagePreloaderUISystem>(),
        () => Mod.Settings.ScreenshotResolution
      );

      this.screenshotExporter = new ScreenshotExporter(Mod.Api);

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
        () => this.screenshotCarousel.HasPrevious
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
        new ScreenshotValueWriter()
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
  /// It appends to and advances the carousel like any other load, so the displayed screenshot stays
  /// consistent with the carousel's cursor.
  /// </summary>
  // ReSharper disable once AsyncVoidMethod
  internal async void LoadScreenshotById(string screenshotId) {
    this.isRefreshingBinding.Update(true);

    try {
      await this.screenshotCarousel.LoadById(screenshotId);

      this.errorBinding.Update(null);
      this.screenshotBinding.Update(this.screenshotCarousel.Current);
      this.hasPreviousScreenshotBinding.Update();
    }
    catch (Exception ex) {
      this.HandleDisplayLoadError(ex);
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
  /// Switches the current screenshot to the previous one, re-preloading its image.
  /// The method is `async void` because it is designed to be called in a fire-and-forget manner,
  /// and it must be designed to never throw.
  /// </summary>
  // ReSharper disable once AsyncVoidMethod
  private async void PreviousScreenshot() {
    if (this.isRefreshingBinding.value) {
      return;
    }

    // Soft, binding-coupled guard kept in the system: the carousel would throw at the first
    // screenshot, but here this is an expected no-op rather than an error.
    if (!this.screenshotCarousel.HasPrevious) {
      Mod.Log.ErrorSilent(
        $"Menu: {nameof(this.PreviousScreenshot)}: " +
        $"Cannot go back, already at the first screenshot."
      );

      return;
    }

    this.isRefreshingBinding.Update(true);

    try {
      await this.screenshotCarousel.Previous();

      this.errorBinding.Update(null);
      this.screenshotBinding.Update(this.screenshotCarousel.Current);
      this.hasPreviousScreenshotBinding.Update();

      Mod.Log.Verbose(
        $"{nameof(PresenterUISystem)}: {nameof(this.PreviousScreenshot)}: " +
        $"Displaying {this.screenshotCarousel.Current} (carousel idx " +
        $"{this.screenshotCarousel.CurrentIndex}/{this.screenshotCarousel.Count - 1})."
      );
    }
    catch (Exception ex) {
      this.HandleDisplayLoadError(ex);
    }
    finally {
      this.isRefreshingBinding.Update(false);
    }
  }

  /// <summary>
  /// Advances to the next screenshot, loading a fresh one when there is no look-ahead in stock,
  /// then prefetches the following one in the background.
  /// The method is `async void` because it is designed to be called in a fire-and-forget manner,
  /// and it should be designed to never throw.
  /// </summary>
  // ReSharper disable once AsyncVoidMethod
  private async void NextScreenshot() {
    if (this.isRefreshingBinding.value) {
      return;
    }

    this.isRefreshingBinding.Update(true);

    try {
      await this.screenshotCarousel.Next();
    }
    catch (Exception ex) {
      // Leave the previously displayed screenshot in place and reset the refresh state.
      this.HandleDisplayLoadError(ex);
      this.isRefreshingBinding.Update(false);

      return;
    }

    // The screenshot is now displayed, so clear any error left over from a prior failed load.
    this.errorBinding.Update(null);

    var screenshot = this.screenshotCarousel.Current;

    this.screenshotBinding.Update(screenshot);
    this.hasPreviousScreenshotBinding.Update();

    Mod.Log.Verbose(
      $"{nameof(PresenterUISystem)}: {nameof(this.NextScreenshot)}: Displaying {screenshot} " +
      $"(carousel idx {this.screenshotCarousel.CurrentIndex}/" +
      $"{this.screenshotCarousel.Count - 1})."
    );

    if (!this.screenshotCarousel.IsAtEnd) {
      // We still have look-ahead screenshots in stock (the user clicked previous once or more), so
      // there is nothing to preload.
      this.isRefreshingBinding.Update(false);
    }
    else {
      // We are viewing the last screenshot in the window: prepare the next one in the background.
      PreloadNextInBackground();
      // It also means the current screenshot was just viewed.
      MarkCurrentViewed();
    }

    return;

    // Fire-and-forget; designed never to throw. Releases the refresh lock in its finally, so it
    // stays held throughout the background prefetch.
    async void PreloadNextInBackground() {
      try {
        await this.screenshotCarousel.PreloadAhead();
      }
      catch (Exception ex) {
        Mod.Log.ErrorSilent(ex);
      }
      finally {
        this.isRefreshingBinding.Update(false);
      }
    }

    // Fire-and-forget; designed never to throw.
    async void MarkCurrentViewed() {
      try {
        if (screenshot is not null) {
          await Mod.Api.MarkScreenshotViewed(screenshot.Id);
        }
      }
      catch (Exception ex) {
        Mod.Log.ErrorSilent(ex);
      }
    }
  }

  /// <summary>
  /// Applies the error policy for a failed display-load (next/previous/load-by-id): a network error
  /// is surfaced to the user via the error binding, anything else is logged as recoverable.
  /// Background prefetch errors are handled separately (logged silently) by their fire-and-forget
  /// wrapper.
  /// </summary>
  private void HandleDisplayLoadError(Exception ex) {
    if (PresenterUISystem.IsNetworkError(ex)) {
      this.errorBinding.Update(ex.GetUserFriendlyMessage());
    }
    else {
      Mod.Log.ErrorRecoverable(ex);
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
        this.screenshotCarousel.Current is null) {
      return;
    }

    this.isTogglingLike = true;

    var prevScreenshot = this.screenshotCarousel.Current;

    var updatedScreenshot = prevScreenshot with {
      IsLiked = !prevScreenshot.IsLiked,
      LikesCount = prevScreenshot.LikesCount + (prevScreenshot.IsLiked ? -1 : 1)
    };

    // Replace the current screenshot with the liked one (optimistic update).
    this.screenshotCarousel.ReplaceCurrent(updatedScreenshot);
    this.screenshotBinding.Update(updatedScreenshot);

    try {
      await Mod.Api.LikeScreenshot(
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
      this.screenshotCarousel.ReplaceCurrent(prevScreenshot);
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

      var filePath = await this.screenshotExporter.Export(
        screenshot,
        Mod.Settings.CreatorsScreenshotSaveDirectory
      );

      Mod.Log.Info($"{nameof(PresenterUISystem)}: Saved {screenshot} image to {filePath}.");
    }
    catch (Exception ex) when (PresenterUISystem.IsNetworkError(ex)) {
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

        await Mod.Api.ReportScreenshot(screenshot.Id);

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

  private static bool IsNetworkError(Exception ex) =>
    ex
      is HttpException
      or ImagePreloadFailedException;
}
