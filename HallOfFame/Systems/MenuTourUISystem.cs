using System;
using Colossal.UI.Binding;
using Game.UI;
using HallOfFame.Domain;
using HallOfFame.Services;
using HallOfFame.Utils.Writers;

namespace HallOfFame.Systems;

/// <summary>
/// The thin binding shell over <see cref="MenuTour"/>, the main menu's one-time tour of the
/// slideshow's controls: it publishes the step, forwards the UI's triggers, and takes the
/// creator's stats from <see cref="StatsNotificationSystem"/>.
/// </summary>
internal sealed partial class MenuTourUISystem : UISystemBase {
  private const string BindingGroup = "hallOfFame.menuTour";

  private MenuTour tour = null!;

  private ValueBinding<string> stepBinding = null!;

  private ValueBinding<bool> isLastStepBinding = null!;

  protected override void OnCreate() {
    base.OnCreate();

    try {
      // Bindings are updated when the tour publishes, never polled.
      this.Enabled = false;

      // The bindings start from the tour's own state, so it only publishes changes.
      this.tour = new MenuTour(Mod.Settings, this.Publish);

      this.stepBinding = new ValueBinding<string>(
        MenuTourUISystem.BindingGroup,
        "step",
        this.tour.Step.ToWireName()
      );

      this.isLastStepBinding = new ValueBinding<bool>(
        MenuTourUISystem.BindingGroup,
        "isLastStep",
        this.tour.IsLastStep
      );

      this.AddBinding(this.stepBinding);
      this.AddBinding(this.isLastStepBinding);

      this.AddBinding(new TriggerBinding(MenuTourUISystem.BindingGroup, "next", this.tour.Next));

      this.AddBinding(new TriggerBinding(MenuTourUISystem.BindingGroup, "close", this.tour.Close));

      this.AddBinding(
        new TriggerBinding(
          MenuTourUISystem.BindingGroup,
          "moreActionsOpened",
          this.tour.OnMoreActionsOpened
        )
      );
    }
    catch (Exception ex) {
      Mod.Log.ErrorFatal(ex);
    }
  }

  /// <summary>
  /// Takes the creator's stats each time the main menu fetches them, for the tour's last step.
  /// </summary>
  internal void ReportCreatorStats(CreatorStats stats) => this.tour.ReportStats(stats);

  private void Publish(MenuTourStep step, bool isLastStep) {
    this.stepBinding.Update(step.ToWireName());
    this.isLastStepBinding.Update(isLastStep);
  }
}
