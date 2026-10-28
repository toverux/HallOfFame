using System;
using System.Collections.Generic;
using Colossal.Serialization.Entities;
using Colossal.UI.Binding;
using Game;
using Game.UI;
using HallOfFame.Domain;
using HallOfFame.Services;
using HallOfFame.Utils.Writers;

namespace HallOfFame.Systems;

/// <summary>
/// The thin binding shell over <see cref="MenuTour"/>, the main menu's one-time tour of the
/// slideshow's controls: it publishes the step, forwards the UI's triggers, and takes the
/// creator's stats from <see cref="StatsNotificationSystem"/>.
/// It also tracks the tour's start and end as usage events.
/// </summary>
internal sealed partial class MenuTourUISystem : UISystemBase {
  private const string BindingGroup = "hallOfFame.menuTour";

  private MenuTour tour = null!;

  private ValueBinding<string> stepBinding = null!;

  private ValueBinding<bool> isLastStepBinding = null!;

  /// <summary>
  /// Whether this session tracked the tour's start, as the tour shows again on each launch until it
  /// is closed, and on each main-menu visit of that launch.
  /// </summary>
  private bool isStartTracked;

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

      // Reaching the end and opening the more-actions menu on the step that asks for it complete
      // the tour, closing it earlier dismisses it.
      // The last step shows no Next button, so its Close is the tour reaching its end.
      this.AddBinding(
        new TriggerBinding(
          MenuTourUISystem.BindingGroup,
          "next",
          () => this.TrackingFinish(this.tour.Next, isCompleted: true)
        )
      );

      this.AddBinding(
        new TriggerBinding(
          MenuTourUISystem.BindingGroup,
          "close",
          () => this.TrackingFinish(this.tour.Close, isCompleted: this.tour.IsLastStep)
        )
      );

      this.AddBinding(
        new TriggerBinding(
          MenuTourUISystem.BindingGroup,
          "moreActionsOpened",
          () => this.TrackingFinish(this.tour.OnMoreActionsOpened, isCompleted: true)
        )
      );
    }
    catch (Exception ex) {
      Mod.Log.ErrorFatal(ex);
    }
  }

  /// <summary>
  /// Tracks the tour's start on the first main-menu load of the session that shows it, which needs
  /// the slideshow, as the tour's balloons point at its controls.
  /// </summary>
  protected override void OnGameLoadingComplete(Purpose purpose, GameMode mode) {
    if (
      mode is not GameMode.MainMenu ||
      !Mod.Settings.EnableMainMenuSlideshow ||
      this.tour.Step is MenuTourStep.None ||
      this.isStartTracked) {
      return;
    }

    this.isStartTracked = true;

    Mod.UsageTracker.Track("tour_started");
  }

  /// <summary>
  /// Takes the creator's stats each time the main menu fetches them, for the tour's last step.
  /// </summary>
  internal void ReportCreatorStats(CreatorStats stats) => this.tour.ReportStats(stats);

  /// <summary>
  /// Runs a trigger of the tour, tracking its end when the trigger ended it.
  /// </summary>
  /// <param name="trigger">The tour's trigger, which may or may not end it.</param>
  /// <param name="isCompleted">
  /// Whether the tour counts as completed when this trigger ends it.
  /// </param>
  private void TrackingFinish(Action trigger, bool isCompleted) {
    var wasShown = this.tour.Step is not MenuTourStep.None;

    trigger();

    if (wasShown && this.tour.Step is MenuTourStep.None) {
      Mod.UsageTracker.Track(
        "tour_finished",
        new Dictionary<string, object> {
          ["completed"] = isCompleted
        }
      );
    }
  }

  private void Publish(MenuTourStep step, bool isLastStep) {
    this.stepBinding.Update(step.ToWireName());
    this.isLastStepBinding.Update(isLastStep);
  }
}
