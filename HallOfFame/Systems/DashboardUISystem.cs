using System;
using System.Threading.Tasks;
using Colossal.UI.Binding;
using Game;
using Game.SceneFlow;
using Game.UI;
using Game.UI.InGame;
using Game.UI.Localization;
using Game.UI.Menu;
using HallOfFame.Domain;
using HallOfFame.Reflection;
using HallOfFame.Services;
using HallOfFame.Systems.Capture;
using HallOfFame.Utils;
using HallOfFame.Utils.Writers;
using UnityEngine;

namespace HallOfFame.Systems;

/// <summary>
/// The Creator Dashboard's thin binding shell over <see cref="DashboardService"/>:
/// it registers the bindings, forwards the UI's triggers to the service,
/// reads the playset for the edit form's picker,
/// and implements <see cref="IDashboardPresentationSink"/>, the delete confirmation and the
/// handover to the slideshow included.
/// C# owns whether the panel is open, so every entry point opens it the same way, the options
/// page's button included.
/// </summary>
internal sealed partial class DashboardUISystem : UISystemBase, IDashboardPresentationSink {
  private const string BindingGroup = "hallOfFame.dashboard";

  private DashboardService service = null!;

  private SlideshowUISystem slideshowUISystem = null!;

  /// <summary>
  /// The game's UI sounds, the ones its audio binding plays for the UI, for the deletion's.
  /// </summary>
  private UISoundCollection? soundCollection;

  private ValueBinding<DashboardState> stateBinding = null!;

  private ValueBinding<DashboardDetailState> detailBinding = null!;

  private ValueBinding<Colossal.PSI.Common.Mod[]> assetModsBinding = null!;

  protected override void OnCreate() {
    base.OnCreate();

    try {
      // Bindings are updated when the service publishes, never polled.
      this.Enabled = false;

      this.service = new DashboardService(Mod.Api, Mod.Log, this);

      this.slideshowUISystem = this.World.GetOrCreateSystemManaged<SlideshowUISystem>();

      this.soundCollection = Resources.Load<UISoundCollection>("Audio/UI Sounds");

      this.stateBinding = new ValueBinding<DashboardState>(
        DashboardUISystem.BindingGroup,
        "state",
        DashboardState.Closed,
        new DashboardStateValueWriter()
      );

      this.AddBinding(this.stateBinding);

      this.detailBinding = new ValueBinding<DashboardDetailState>(
        DashboardUISystem.BindingGroup,
        "detail",
        DashboardDetailState.Closed,
        new DashboardDetailStateValueWriter()
      );

      this.AddBinding(this.detailBinding);

      this.assetModsBinding = new ValueBinding<Colossal.PSI.Common.Mod[]>(
        DashboardUISystem.BindingGroup,
        "assetMods",
        [],
        new ListWriter<Colossal.PSI.Common.Mod>(new AssetModValueWriter())
      );

      this.AddBinding(this.assetModsBinding);

      // Fire-and-forget edges: the service entry points are designed never to throw.
      this.AddBinding(new TriggerBinding(DashboardUISystem.BindingGroup, "open", this.Open));

      this.AddBinding(
        new TriggerBinding(
          DashboardUISystem.BindingGroup,
          "close",
          this.service.Close
        )
      );

      this.AddBinding(
        new TriggerBinding(
          DashboardUISystem.BindingGroup,
          "confirmClose",
          () => { _ = this.service.ConfirmClose(); }
        )
      );

      this.AddBinding(
        new TriggerBinding(
          DashboardUISystem.BindingGroup,
          "refresh",
          () => { _ = this.service.Refresh(); }
        )
      );

      this.AddBinding(
        new TriggerBinding<string>(
          DashboardUISystem.BindingGroup,
          "openDetail",
          screenshotId => { _ = this.service.OpenDetail(screenshotId); }
        )
      );

      this.AddBinding(
        new TriggerBinding(
          DashboardUISystem.BindingGroup,
          "closeDetail",
          this.service.CloseDetail
        )
      );

      this.AddBinding(
        new TriggerBinding(
          DashboardUISystem.BindingGroup,
          "confirmCloseDetail",
          () => { _ = this.service.ConfirmCloseDetail(); }
        )
      );

      this.AddBinding(
        new TriggerBinding<ScreenshotUpdate>(
          DashboardUISystem.BindingGroup,
          "update",
          update => { _ = this.service.Update(update); }
        )
      );

      this.AddBinding(
        new TriggerBinding(
          DashboardUISystem.BindingGroup,
          "delete",
          () => { _ = this.service.Delete(); }
        )
      );

      this.AddBinding(
        new TriggerBinding(
          DashboardUISystem.BindingGroup,
          "showInSlideshow",
          this.service.ShowInSlideshow
        )
      );
    }
    catch (Exception ex) {
      Mod.Log.ErrorFatal(ex);
    }
  }

  /// <summary>
  /// Opens the dashboard from the mod's options page, leaving the options for the screen the
  /// dashboard renders on: the main menu's own, or the game's view, the pause menu closing too.
  /// </summary>
  internal void OpenFromOptions() {
    switch (GameManager.instance.gameMode) {
      case GameMode.MainMenu:
        this.World.GetOrCreateSystemManaged<MenuUISystem>().activeScreen =
          MenuUISystem.MenuScreen.Menu;

        break;

      case GameMode.Game:
        this.World.GetOrCreateSystemManaged<GameScreenUISystem>()
          .SetScreen(GameScreenUISystem.GameScreen.Main);

        break;

      default: return;
    }

    this.Open();
  }

  /// <summary>
  /// Opens the dashboard on a screenshot's detail view, the upload panel's shortcut.
  /// </summary>
  internal void OpenOnScreenshot(string screenshotId) {
    _ = this.service.OpenOnScreenshot(screenshotId);
    _ = this.PublishAssetMods();
  }

  void IDashboardPresentationSink.Publish(DashboardState state) => this.stateBinding.Update(state);

  void IDashboardPresentationSink.PublishDetail(DashboardDetailState detail) =>
    this.detailBinding.Update(detail);

  void IDashboardPresentationSink.ShowError(LocalizedString message) =>
    ErrorDialogManagerAccessor.ShowError(message);

  async Task<bool> IDashboardPresentationSink.ConfirmDelete(Screenshot screenshot) {
    var dialog = new ConfirmationDialog(
      LocalizedString.IdWithArgs(
        "HallOfFame.Systems.DashboardUI.CONFIRM_DELETE_DIALOG[Title]",
        ("CITY_NAME", LocalizedString.Value(screenshot.CityName))
      ),
      LocalizedString.Id("HallOfFame.Systems.DashboardUI.CONFIRM_DELETE_DIALOG[Message]"),
      LocalizedString.Id("HallOfFame.Systems.DashboardUI.CONFIRM_DELETE_DIALOG[ConfirmAction]"),
      LocalizedString.IdWithFallback("Common.ACTION[Cancel]", "Cancel")
    );

    return await DashboardUISystem.Confirm(dialog);
  }

  async Task<bool> IDashboardPresentationSink.ConfirmDiscardEdits(Screenshot screenshot) {
    var dialog = new ConfirmationDialog(
      LocalizedString.IdWithArgs(
        "HallOfFame.Systems.DashboardUI.CONFIRM_DISCARD_DIALOG[Title]",
        ("CITY_NAME", LocalizedString.Value(screenshot.CityName))
      ),
      LocalizedString.Id("HallOfFame.Systems.DashboardUI.CONFIRM_DISCARD_DIALOG[Message]"),
      LocalizedString.Id("HallOfFame.Systems.DashboardUI.CONFIRM_DISCARD_DIALOG[ConfirmAction]"),
      LocalizedString.Id("HallOfFame.Systems.DashboardUI.CONFIRM_DISCARD_DIALOG[CancelAction]")
    );

    return await DashboardUISystem.Confirm(dialog);
  }

  void IDashboardPresentationSink.PlayDeletedSound() {
    // A plain comparison, not `?.`: a Unity object answers null through its own operator.
    if (this.soundCollection != null) {
      this.soundCollection.PlaySound("bulldoze-end");
    }
  }

  void IDashboardPresentationSink.ShowInSlideshow(Screenshot screenshot) =>
    this.slideshowUISystem.ShowScreenshot(screenshot);

  /// <summary>
  /// Shows a confirmation dialog, resolving to whether the player chose its confirm action.
  /// </summary>
  private static async Task<bool> Confirm(ConfirmationDialog dialog) {
    var choice = await GameManager.instance.userInterface.appBindings
      .ShowConfirmationDialogAndWait(dialog);

    return choice is 0;
  }

  private void Open() {
    _ = this.service.Open();
    _ = this.PublishAssetMods();
  }

  /// <summary>
  /// Publishes the active playset's asset mods, the ones the edit form can showcase, in the
  /// upload panel's shape.
  /// They are read afresh on each open: the capture system's own list is read once per game
  /// session, and the playset changes in between.
  /// Empty when the playset cannot be read.
  /// Designed never to throw, so the open trigger can fire-and-forget it.
  /// </summary>
  private async Task PublishAssetMods() {
    Colossal.PSI.Common.Mod[] assetMods = [];

    try {
      var mods = await CitySnapshotProvider.ReadActiveMods();

      if (mods is not null) {
        assetMods = CitySnapshotProvider.SelectAssetMods(mods);
      }
    }
    catch (Exception ex) {
      Mod.Log.ErrorRecoverable(ex);
    }

    this.assetModsBinding.Update(assetMods);
  }
}
