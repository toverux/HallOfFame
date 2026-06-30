using System;
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
using HallOfFame.Reflection;
using HallOfFame.Services;
using HallOfFame.Utils;
using HallOfFame.Utils.Writers;
using UnityEngine.InputSystem;

namespace HallOfFame.Systems;

/// <summary>
/// System in charge of handling the presentation of community images and the various interactions
/// that come with it (next, prev, like, etc.).
/// <para>
/// It is the thin production adapter for <see cref="SlideshowConductor"/>: it registers the engine
/// bindings, forwards engine events (trigger bindings, game-mode changes) to the conductor, and
/// implements <see cref="ISlideshowPresentationSink"/> to enact the engine side effects the
/// conductor decides.
/// All orchestration lives in the conductor; this shell keeps only binding plumbing, event
/// forwarding, and the force-enable dev keybinding.
/// </para>
/// </summary>
internal sealed partial class SlideshowUISystem : UISystemBase, ISlideshowPresentationSink {
  private const string BindingGroup = "hallOfFame.slideshow";

  private SlideshowConductor conductor = null!;

  private bool forceEnableMainMenuSlideshow;

  private ProxyAction forceEnableMainMenuSlideshowAction = null!;

  private GetterValueBinding<bool> enableMainMenuSlideshowBinding = null!;

  private ValueBinding<bool> hasPreviousScreenshotBinding = null!;

  private ValueBinding<int> forcedRefreshIndexBinding = null!;

  private ValueBinding<bool> canAdvanceBinding = null!;

  private ValueBinding<Screenshot?> screenshotBinding = null!;

  private ValueBinding<LocalizedString?> loadErrorBinding = null!;

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

  protected override void OnCreate() {
    base.OnCreate();

    try {
      // No need to OnUpdate as there are no bindings that require it, they are manually updated
      // when needed.
      this.Enabled = false;

      // The conductor owns all orchestration; this system only registers bindings, forwards events
      // to it, and implements the sink it pushes engine effects through.
      this.conductor = new SlideshowConductor(
        Mod.Api,
        this.World.GetOrCreateSystemManaged<ImagePreloaderUISystem>(),
        Mod.Log,
        Mod.Settings,
        this
      );

      this.forceEnableMainMenuSlideshowAction =
        Mod.Settings.GetAction(nameof(Settings.KeyBindingForceEnableMainMenuSlideshow));

      // VALUE BINDINGS
      this.enableMainMenuSlideshowBinding = new GetterValueBinding<bool>(
        SlideshowUISystem.BindingGroup,
        "enableMainMenuSlideshow",
        () => this.forceEnableMainMenuSlideshow || Mod.Settings.EnableMainMenuSlideshow
      );

      this.hasPreviousScreenshotBinding = new ValueBinding<bool>(
        SlideshowUISystem.BindingGroup,
        "hasPreviousScreenshot",
        false
      );

      this.forcedRefreshIndexBinding = new ValueBinding<int>(
        SlideshowUISystem.BindingGroup,
        "forcedRefreshIndex",
        1
      );

      this.canAdvanceBinding = new ValueBinding<bool>(
        SlideshowUISystem.BindingGroup,
        "canAdvance",
        true
      );

      this.screenshotBinding = new ValueBinding<Screenshot?>(
        SlideshowUISystem.BindingGroup,
        "screenshot",
        null,
        new ScreenshotValueWriter()
      );

      this.loadErrorBinding = new ValueBinding<LocalizedString?>(
        SlideshowUISystem.BindingGroup,
        "loadError",
        null,
        new ValueWriter<LocalizedString>().Nullable()
      );

      this.isSavingBinding = new ValueBinding<bool>(
        SlideshowUISystem.BindingGroup,
        "isSaving",
        false
      );

      this.AddBinding(this.enableMainMenuSlideshowBinding);
      this.AddBinding(this.hasPreviousScreenshotBinding);
      this.AddBinding(this.forcedRefreshIndexBinding);
      this.AddBinding(this.canAdvanceBinding);
      this.AddBinding(this.screenshotBinding);
      this.AddBinding(this.loadErrorBinding);
      this.AddBinding(this.isSavingBinding);

      // INPUT ACTION BINDINGS
      this.previousScreenshotInputActionBinding = new InputActionBinding(
        SlideshowUISystem.BindingGroup,
        "previousScreenshotInputAction",
        Mod.Settings.KeyBindingPrevious
      );

      this.nextScreenshotInputActionBinding = new InputActionBinding(
        SlideshowUISystem.BindingGroup,
        "nextScreenshotInputAction",
        Mod.Settings.KeyBindingNext
      );

      this.likeScreenshotInputActionBinding = new InputActionBinding(
        SlideshowUISystem.BindingGroup,
        "likeScreenshotInputAction",
        Mod.Settings.KeyBindingLike
      );

      this.toggleMenuInputActionBinding = new InputActionBinding(
        SlideshowUISystem.BindingGroup,
        "toggleMenuInputAction",
        Mod.Settings.KeyBindingToggleMenu
      );

      this.AddBinding(this.previousScreenshotInputActionBinding);
      this.AddBinding(this.nextScreenshotInputActionBinding);
      this.AddBinding(this.likeScreenshotInputActionBinding);
      this.AddBinding(this.toggleMenuInputActionBinding);

      // TRIGGER BINDINGS
      // Fire-and-forget edges: the conductor entry points are designed never to throw, so the
      // discarded task is the single async boundary between the engine triggers and the conductor.
      this.previousScreenshotBinding = new TriggerBinding(
        SlideshowUISystem.BindingGroup,
        "previousScreenshot",
        () => { _ = this.conductor.Previous(); }
      );

      this.nextScreenshotBinding = new TriggerBinding(
        SlideshowUISystem.BindingGroup,
        "nextScreenshot",
        () => { _ = this.conductor.Next(); }
      );

      this.likeScreenshotBinding = new TriggerBinding(
        SlideshowUISystem.BindingGroup,
        "likeScreenshot",
        () => { _ = this.conductor.Like(); }
      );

      this.saveScreenshotBinding = new TriggerBinding(
        SlideshowUISystem.BindingGroup,
        "saveScreenshot",
        () => { _ = this.conductor.Save(); }
      );

      this.reportScreenshotBinding = new TriggerBinding(
        SlideshowUISystem.BindingGroup,
        "reportScreenshot",
        () => { _ = this.conductor.Report(); }
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
  /// menu: forwards the game-mode change to the conductor (which owns the refresh decision) and
  /// re-gates the force-enable keybinding.
  /// </summary>
  protected override void OnGameLoadingComplete(Purpose purpose, GameMode mode) {
    this.conductor.OnGameModeChanged(mode);

    this.EnableOrDisableEnableMainMenuSlideshowAction();
  }

  #if DEBUG
  /// <summary>
  /// Debug/development method to load a screenshot by its ID, forwarded to the conductor.
  /// </summary>
  internal void LoadScreenshotById(string screenshotId) {
    _ = this.conductor.LoadById(screenshotId);
  }
  #endif

  void ISlideshowPresentationSink.PublishScreenshot(Screenshot? screenshot) {
    this.screenshotBinding.Update(screenshot);
  }

  void ISlideshowPresentationSink.PublishLoadError(LocalizedString? error) {
    this.loadErrorBinding.Update(error);
  }

  void ISlideshowPresentationSink.SetCanAdvance(bool canAdvance) {
    this.canAdvanceBinding.Update(canAdvance);
  }

  void ISlideshowPresentationSink.SetHasPrevious(bool hasPrevious) {
    this.hasPreviousScreenshotBinding.Update(hasPrevious);
  }

  void ISlideshowPresentationSink.SetSaving(bool isSaving) {
    this.isSavingBinding.Update(isSaving);
  }

  void ISlideshowPresentationSink.ShowError(LocalizedString message) {
    ErrorDialogManagerAccessor.Instance?.ShowError(
      new ErrorDialog {
        localizedTitle = "HallOfFame.Common.OOPS",
        localizedMessage = message,
        actions = ErrorDialog.ActionBits.Continue
      }
    );
  }

  Task<bool> ISlideshowPresentationSink.ConfirmReport(Screenshot screenshot) {
    var confirmation = new TaskCompletionSource<bool>();

    var dialog = new ConfirmationDialog(
      LocalizedString.IdWithArgs(
        "HallOfFame.Systems.SlideshowUI.CONFIRM_REPORT_DIALOG[Title]",
        ("CITY_NAME", LocalizedString.Value(screenshot.CityName)),
        ("AUTHOR_NAME", LocalizedString.Value(screenshot.Creator?.CreatorName))
      ),
      LocalizedString.Id("HallOfFame.Systems.SlideshowUI.CONFIRM_REPORT_DIALOG[Message]"),
      LocalizedString.Id("HallOfFame.Systems.SlideshowUI.CONFIRM_REPORT_DIALOG[ConfirmAction]"),
      LocalizedString.IdWithFallback("Common.ACTION[Cancel]", "Cancel")
    );

    GameManager.instance.userInterface.appBindings
      .ShowConfirmationDialog(dialog, choice => confirmation.SetResult(choice is 0));

    return confirmation.Task;
  }

  void ISlideshowPresentationSink.ShowReportSuccess() {
    var successDialog = new MessageDialog(
      LocalizedString.Id("HallOfFame.Systems.SlideshowUI.REPORT_SUCCESS_DIALOG[Title]"),
      LocalizedString.Id("HallOfFame.Systems.SlideshowUI.REPORT_SUCCESS_DIALOG[Message]"),
      LocalizedString.IdWithFallback("Common.CLOSE", "Close")
    );

    GameManager.instance.userInterface.appBindings
      .ShowMessageDialog(successDialog, _ => { });
  }

  void ISlideshowPresentationSink.RequestRefresh() {
    this.forcedRefreshIndexBinding.Update(this.forcedRefreshIndexBinding.value + 1);
  }

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
}
