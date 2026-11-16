using System.Collections.Generic;
using HallOfFame.Domain;
using HallOfFame.Services;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class MenuTourTests {
  [Fact]
  public void Step_StartsOnTheNavigation_BeforeTheTourWasSeen() {
    var tour = new MenuTour(new FakeMenuTourStore(), (_, _) => {});

    Assert.Equal(MenuTourStep.Navigation, tour.Step);
    Assert.False(tour.IsLastStep);
  }

  [Fact]
  public void Step_IsNone_OnceTheTourWasSeenInAnEarlierSession() {
    var tour = new MenuTour(
      new FakeMenuTourStore {
        HasSeenMenuTour = true
      },
      (_, _) => {}
    );

    Assert.Equal(MenuTourStep.None, tour.Step);
  }

  [Fact]
  public void ReportShown_SavesTheSeenTour_OnceAndAtOnce() {
    var store = new FakeMenuTourStore();
    var published = new List<(MenuTourStep, bool)>();

    var tour = new MenuTour(store, (step, isLast) => published.Add((step, isLast)));

    Assert.True(tour.ReportShown());
    Assert.Equal([true], store.Saves);

    // A UI reload or the next step's balloon reports again, which changes nothing.
    tour.Next();

    Assert.False(tour.ReportShown());
    Assert.Equal([true], store.Saves);

    // The tour goes on showing for the rest of the session, and a restart finds it seen.
    Assert.Equal([(MenuTourStep.MenuVisibility, false)], published);
    Assert.Equal(MenuTourStep.None, new MenuTour(store, (_, _) => {}).Step);
  }

  [Fact]
  public void ReportShown_StartsNothing_OnceTheTourWasSeenInAnEarlierSession() {
    var store = new FakeMenuTourStore {
      HasSeenMenuTour = true
    };

    var tour = new MenuTour(store, (_, _) => {});

    Assert.False(tour.ReportShown());
    Assert.Empty(store.Saves);
  }

  [Fact]
  public void Next_EndsOnTheLikeStep_WithoutScreenshots() {
    var store = new FakeMenuTourStore();
    var published = new List<(MenuTourStep, bool)>();

    var tour = new MenuTour(store, (step, isLast) => published.Add((step, isLast)));

    tour.ReportShown();
    tour.ReportStats(MenuTourTests.StatsWith(0));
    tour.Next();
    tour.Next();
    tour.Next();

    Assert.Equal(
      [(MenuTourStep.MenuVisibility, false), (MenuTourStep.Like, true), (MenuTourStep.None, false)],
      published
    );

    // Saved at the first balloon, not again at the end.
    Assert.Equal([true], store.Saves);
  }

  [Fact]
  public void Next_GoesOnToTheDashboard_WithAScreenshot() {
    var store = new FakeMenuTourStore();
    var published = new List<(MenuTourStep, bool)>();

    var tour = new MenuTour(store, (step, isLast) => published.Add((step, isLast)));

    tour.ReportShown();
    tour.ReportStats(MenuTourTests.StatsWith(1));
    tour.Next();
    tour.Next();
    tour.Next();

    Assert.Equal(
      [
        (MenuTourStep.MenuVisibility, false),
        (MenuTourStep.Like, false),
        (MenuTourStep.Dashboard, true)
      ],
      published
    );

    tour.Next();

    Assert.Equal(MenuTourStep.None, tour.Step);
    Assert.Equal([true], store.Saves);
  }

  [Fact]
  public void ReportStats_RepublishesTheLikeStep_WhenItStopsBeingTheLast() {
    var published = new List<(MenuTourStep, bool)>();

    var tour = new MenuTour(
      new FakeMenuTourStore(),
      (step, isLast) => published.Add((step, isLast))
    );

    tour.Next();
    tour.Next();
    tour.ReportStats(MenuTourTests.StatsWith(1));

    // Another non-zero count changes nothing.
    tour.ReportStats(MenuTourTests.StatsWith(2));

    Assert.Equal(
      [(MenuTourStep.MenuVisibility, false), (MenuTourStep.Like, true), (MenuTourStep.Like, false)],
      published
    );
  }

  [Fact]
  public void Close_EndsTheTourForGood_FromAnyStep() {
    var store = new FakeMenuTourStore();
    var published = new List<(MenuTourStep, bool)>();

    var tour = new MenuTour(store, (step, isLast) => published.Add((step, isLast)));

    tour.Close();

    Assert.Equal([(MenuTourStep.None, false)], published);
    Assert.True(store.HasSeenMenuTour);

    // Further presses change nothing, and a restart finds the tour seen.
    tour.Next();
    tour.Close();

    Assert.Single(published);
    Assert.Equal(MenuTourStep.None, new MenuTour(store, (_, _) => {}).Step);
  }

  [Fact]
  public void Close_SavesTheSeenTour_OnlyWhenNoBalloonReportedItFirst() {
    var reportedStore = new FakeMenuTourStore();

    var reportedTour = new MenuTour(reportedStore, (_, _) => {});

    reportedTour.ReportShown();
    reportedTour.Close();

    Assert.Equal([true], reportedStore.Saves);

    // A balloon precedes every close in the UI, but a closed tour is a seen tour either way.
    var unreportedStore = new FakeMenuTourStore();

    var unreportedTour = new MenuTour(unreportedStore, (_, _) => {});

    unreportedTour.Next();

    Assert.Empty(unreportedStore.Saves);

    unreportedTour.Close();
    unreportedTour.Close();

    Assert.Equal([true], unreportedStore.Saves);
  }

  [Fact]
  public void OnMainMenuLeft_KeepsTheTour_BeforeAnyBalloonShowed() {
    var store = new FakeMenuTourStore();
    var published = new List<(MenuTourStep, bool)>();

    var tour = new MenuTour(store, (step, isLast) => published.Add((step, isLast)));

    tour.OnMainMenuLeft();

    Assert.Equal(MenuTourStep.Navigation, tour.Step);
    Assert.Empty(published);
    Assert.Empty(store.Saves);

    // The next main menu shows it, and that report starts it.
    Assert.True(tour.ReportShown());
  }

  [Fact]
  public void OnMainMenuLeft_EndsTheTour_OnceABalloonShowed() {
    var store = new FakeMenuTourStore();
    var published = new List<(MenuTourStep, bool)>();

    var tour = new MenuTour(store, (step, isLast) => published.Add((step, isLast)));

    tour.ReportShown();
    tour.OnMainMenuLeft();

    Assert.Equal([(MenuTourStep.None, false)], published);
    Assert.Equal([true], store.Saves);
  }

  [Fact]
  public void OnMoreActionsOpened_EndsTheTour_OnlyOnTheDashboardStep() {
    var store = new FakeMenuTourStore();

    var tour = new MenuTour(store, (_, _) => {});

    tour.ReportShown();
    tour.ReportStats(MenuTourTests.StatsWith(1));
    tour.OnMoreActionsOpened();

    Assert.Equal(MenuTourStep.Navigation, tour.Step);

    tour.Next();
    tour.Next();
    tour.Next();
    tour.OnMoreActionsOpened();

    Assert.Equal(MenuTourStep.None, tour.Step);
    Assert.Equal([true], store.Saves);
  }

  private static CreatorStats StatsWith(int screenshotsCount) =>
    new() {
      ScreenshotsCount = screenshotsCount
    };
}
