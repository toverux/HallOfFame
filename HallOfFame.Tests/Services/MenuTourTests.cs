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
  public void Next_EndsOnTheLikeStep_WithoutScreenshots() {
    var store = new FakeMenuTourStore();
    var published = new List<(MenuTourStep, bool)>();

    var tour = new MenuTour(store, (step, isLast) => published.Add((step, isLast)));

    tour.ReportStats(MenuTourTests.StatsWith(0));
    tour.Next();
    tour.Next();
    tour.Next();

    Assert.Equal(
      [(MenuTourStep.MenuVisibility, false), (MenuTourStep.Like, true), (MenuTourStep.None, false)],
      published
    );

    Assert.True(store.HasSeenMenuTour);
  }

  [Fact]
  public void Next_GoesOnToTheDashboard_WithAScreenshot() {
    var store = new FakeMenuTourStore();
    var published = new List<(MenuTourStep, bool)>();

    var tour = new MenuTour(store, (step, isLast) => published.Add((step, isLast)));

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

    Assert.False(store.HasSeenMenuTour);

    tour.Next();

    Assert.Equal(MenuTourStep.None, tour.Step);
    Assert.True(store.HasSeenMenuTour);
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
  public void Close_SavesTheSeenTour_OnceAndAtOnce() {
    var store = new FakeMenuTourStore();

    var tour = new MenuTour(store, (_, _) => {});

    tour.Next();

    Assert.Empty(store.Saves);

    tour.Close();
    tour.Close();

    Assert.Equal([true], store.Saves);
  }

  [Fact]
  public void OnMoreActionsOpened_EndsTheTour_OnlyOnTheDashboardStep() {
    var store = new FakeMenuTourStore();

    var tour = new MenuTour(store, (_, _) => {});

    tour.ReportStats(MenuTourTests.StatsWith(1));
    tour.OnMoreActionsOpened();

    Assert.Equal(MenuTourStep.Navigation, tour.Step);

    tour.Next();
    tour.Next();
    tour.Next();
    tour.OnMoreActionsOpened();

    Assert.Equal(MenuTourStep.None, tour.Step);
    Assert.True(store.HasSeenMenuTour);
  }

  private static CreatorStats StatsWith(int screenshotsCount) =>
    new() {
      ScreenshotsCount = screenshotsCount
    };
}
