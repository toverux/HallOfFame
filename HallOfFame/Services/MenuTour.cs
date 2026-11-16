using System;
using HallOfFame.Domain;

namespace HallOfFame.Services;

/// <summary>
/// Steps the main menu's one-time tour of the slideshow's controls, one balloon on each in turn:
/// the navigation buttons, the menu visibility toggle, the like button, then the more-actions menu
/// holding the Creator Dashboard, a step only a creator with a screenshot gets.
/// It counts as seen, saved at once, from the moment its first balloon is on screen, so a crash or a
/// quit never brings it back. Closing it on any step, leaving the main menu after a balloon showed,
/// or opening the more-actions menu on the dashboard's step ends it.
/// <para>
/// The screenshot count comes from <see cref="StatsNotifier"/>'s fetch on each main-menu visit:
/// until one succeeds, the tour ends on the like step.
/// </para>
/// </summary>
internal sealed class MenuTour(IMenuTourStore store, Action<MenuTourStep, bool> publish) {
  // No property to fold it into: IsLastStep reads it together with Step.
  #pragma warning disable IDE0032
  private bool hasScreenshots;
  #pragma warning restore IDE0032

  /// <summary>
  /// The step shown, <see cref="MenuTourStep.None"/> once the tour is over.
  /// </summary>
  internal MenuTourStep Step { get; private set; } =
    store.HasSeenMenuTour ? MenuTourStep.None : MenuTourStep.Navigation;

  /// <summary>
  /// Whether <see cref="Step"/> is the tour's last, whose button closes it rather than moving on.
  /// </summary>
  internal bool IsLastStep =>
    this.Step is MenuTourStep.Dashboard ||
    (this.Step is MenuTourStep.Like && !this.hasScreenshots);

  /// <summary>
  /// Takes the creator's latest screenshot count from their stats, which decides whether the tour
  /// goes on to the dashboard's step.
  /// </summary>
  internal void ReportStats(CreatorStats stats) {
    var wasLastStep = this.IsLastStep;

    this.hasScreenshots = stats.ScreenshotsCount > 0;

    if (this.IsLastStep != wasLastStep) {
      this.Publish();
    }
  }

  /// <summary>
  /// Records that a balloon of the tour is on screen, which makes the tour a seen one, saved at
  /// once so that a crash or a quit never brings it back.
  /// The tour goes on showing for the rest of the session.
  /// </summary>
  /// <returns>Whether this report started the tour, true only on the first one.</returns>
  internal bool ReportShown() {
    if (this.Step is MenuTourStep.None || store.HasSeenMenuTour) {
      return false;
    }

    this.MarkSeen();

    return true;
  }

  /// <summary>
  /// Moves on to the next step, or ends the tour from its last.
  /// </summary>
  internal void Next() {
    if (this.IsLastStep) {
      this.Close();
    }
    else if (this.Step is not MenuTourStep.None) {
      this.Step++;

      this.Publish();
    }
  }

  /// <summary>
  /// Ends the tour for good, whichever step it is on.
  /// </summary>
  internal void Close() {
    if (this.Step is MenuTourStep.None) {
      return;
    }

    if (!store.HasSeenMenuTour) {
      this.MarkSeen();
    }

    this.Step = MenuTourStep.None;

    this.Publish();
  }

  private void MarkSeen() {
    store.HasSeenMenuTour = true;
    store.Save();
  }

  /// <summary>
  /// Records that the player left the main menu, which unmounts the tour's balloons without a
  /// trigger: a tour a balloon showed ends for good, one none showed waits for the next main menu.
  /// </summary>
  internal void OnMainMenuLeft() {
    if (store.HasSeenMenuTour) {
      this.Close();
    }
  }

  /// <summary>
  /// Records that the player opened the more-actions menu, which ends the tour when its step was
  /// pointing at that very menu.
  /// </summary>
  internal void OnMoreActionsOpened() {
    if (this.Step is MenuTourStep.Dashboard) {
      this.Close();
    }
  }

  private void Publish() => publish(this.Step, this.IsLastStep);
}

/// <summary>
/// The steps of <see cref="MenuTour"/>, in the order it shows them.
/// </summary>
internal enum MenuTourStep {
  None,

  Navigation,

  MenuVisibility,

  Like,

  Dashboard
}
