using System;
using System.Threading.Tasks;
using Colossal.UI.Binding;
using Game;
using Game.SceneFlow;
using Game.UI;
using Game.UI.Localization;
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
/// C# owns whether the panel is open, so every entry point opens it the same way.
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
      this.AddBinding(
        new TriggerBinding(
          DashboardUISystem.BindingGroup,
          "open",
          () => {
            _ = this.service.Open();
            _ = this.PublishAssetMods();
          }
        )
      );

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

  void IDashboardPresentationSink.Publish(DashboardState state) => this.stateBinding.Update(state);

  void IDashboardPresentationSink.PublishDetail(DashboardDetailState detail) =>
    this.detailBinding.Update(detail);

  void IDashboardPresentationSink.ShowError(LocalizedString message) =>
    ErrorDialogManagerAccessor.ShowError(message);

  Task<bool> IDashboardPresentationSink.ConfirmDelete(Screenshot screenshot) {
    var confirmation = new TaskCompletionSource<bool>();

    var dialog = new ConfirmationDialog(
      LocalizedString.IdWithArgs(
        "HallOfFame.Systems.DashboardUI.CONFIRM_DELETE_DIALOG[Title]",
        ("CITY_NAME", LocalizedString.Value(screenshot.CityName))
      ),
      LocalizedString.Id("HallOfFame.Systems.DashboardUI.CONFIRM_DELETE_DIALOG[Message]"),
      LocalizedString.Id("HallOfFame.Systems.DashboardUI.CONFIRM_DELETE_DIALOG[ConfirmAction]"),
      LocalizedString.IdWithFallback("Common.ACTION[Cancel]", "Cancel")
    );

    GameManager.instance.userInterface.appBindings
      .ShowConfirmationDialog(dialog, choice => confirmation.SetResult(choice is 0));

    return confirmation.Task;
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
