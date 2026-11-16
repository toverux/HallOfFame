using System.Collections.Generic;
using System.Linq;
using HallOfFame.Domain;
using HallOfFame.Services;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class MenuTourTests {
  [Fact]
  public void Step_StartsOnTheNavigation_BeforeTheTourWasSeen() {
    var tour = MenuTourTests.MakeTour(new FakeMenuTourStore());

    Assert.Equal(MenuTourStep.Navigation, tour.Step);
    Assert.False(tour.IsLastStep);
  }

  [Fact]
  public void Step_IsNone_OnceTheTourWasSeenInAnEarlierSession() {
    var tour = MenuTourTests.MakeTour(
      new FakeMenuTourStore {
        HasSeenMenuTour = true
      }
    );

    Assert.Equal(MenuTourStep.None, tour.Step);
  }

  [Fact]
  public void ReportShown_SavesTheSeenTour_OnceAndAtOnce() {
    var store = new FakeMenuTourStore();
    var published = new List<(MenuTourStep, bool)>();

    var tour = MenuTourTests.MakeTour(store, published);

    tour.ReportShown();

    Assert.Equal([true], store.Saves);

    // A UI reload or the next step's balloon reports again, which changes nothing.
    tour.Next();
    tour.ReportShown();

    Assert.Equal([true], store.Saves);

    // The tour goes on showing for the rest of the session, and a restart finds it seen.
    Assert.Equal([(MenuTourStep.MenuVisibility, false)], published);
    Assert.Equal(MenuTourStep.None, MenuTourTests.MakeTour(store).Step);
  }

  [Fact]
  public void ReportShown_StartsNothing_OnceTheTourWasSeenInAnEarlierSession() {
    var store = new FakeMenuTourStore {
      HasSeenMenuTour = true
    };

    var tracked = new List<string>();

    var tour = MenuTourTests.MakeTour(store, tracked: tracked);

    tour.ReportShown();

    Assert.Empty(store.Saves);
    Assert.Empty(tracked);
  }

  [Fact]
  public void Next_EndsOnTheLikeStep_WithoutScreenshots() {
    var store = new FakeMenuTourStore();
    var published = new List<(MenuTourStep, bool)>();

    var tour = MenuTourTests.MakeTour(store, published);

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

    var tour = MenuTourTests.MakeTour(store, published);

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

    var tour = MenuTourTests.MakeTour(new FakeMenuTourStore(), published);

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

    var tour = MenuTourTests.MakeTour(store, published);

    tour.Close();

    Assert.Equal([(MenuTourStep.None, false)], published);
    Assert.True(store.HasSeenMenuTour);

    // Further presses change nothing, and a restart finds the tour seen.
    tour.Next();
    tour.Close();

    Assert.Single(published);
    Assert.Equal(MenuTourStep.None, MenuTourTests.MakeTour(store).Step);
  }

  [Fact]
  public void Close_SavesTheSeenTour_OnlyWhenNoBalloonReportedItFirst() {
    var reportedStore = new FakeMenuTourStore();

    var reportedTour = MenuTourTests.MakeTour(reportedStore);

    reportedTour.ReportShown();
    reportedTour.Close();

    Assert.Equal([true], reportedStore.Saves);

    // A balloon precedes every close in the UI, but a closed tour is a seen tour either way.
    var unreportedStore = new FakeMenuTourStore();

    var unreportedTour = MenuTourTests.MakeTour(unreportedStore);

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
    var tracked = new List<string>();

    var tour = MenuTourTests.MakeTour(store, published, tracked);

    tour.OnMainMenuLeft();

    Assert.Equal(MenuTourStep.Navigation, tour.Step);
    Assert.Empty(published);
    Assert.Empty(store.Saves);

    // The next main menu shows it, and that report starts it.
    tour.ReportShown();

    Assert.Equal(["tour_started"], tracked);
  }

  [Fact]
  public void OnMainMenuLeft_EndsTheTour_OnceABalloonShowed() {
    var store = new FakeMenuTourStore();
    var published = new List<(MenuTourStep, bool)>();

    var tour = MenuTourTests.MakeTour(store, published);

    tour.ReportShown();
    tour.OnMainMenuLeft();

    Assert.Equal([(MenuTourStep.None, false)], published);
    Assert.Equal([true], store.Saves);
  }

  [Fact]
  public void OnMoreActionsOpened_EndsTheTour_OnlyOnTheDashboardStep() {
    var store = new FakeMenuTourStore();

    var tour = MenuTourTests.MakeTour(store);

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

  [Fact]
  public void ReportShown_TracksTheTourStarted_OnceAtTheFirstBalloon() {
    var tracked = new List<string>();

    var tour = MenuTourTests.MakeTour(new FakeMenuTourStore(), tracked: tracked);

    tour.ReportShown();
    tour.Next();
    tour.ReportShown();

    Assert.Equal(["tour_started"], tracked);
  }

  [Fact]
  public void Next_TracksTheTourCompleted_OnTheLastStep() {
    var tracked = new List<string>();

    var tour = MenuTourTests.MakeTour(new FakeMenuTourStore(), tracked: tracked);

    tour.ReportShown();
    tour.ReportStats(MenuTourTests.StatsWith(0));
    tour.Next();
    tour.Next();
    tour.Next();

    Assert.Equal(
      ["tour_started", "tour_finished completed=true leftMenu=false step=\"like\""],
      tracked
    );
  }

  [Fact]
  public void Close_TracksTheTourCompleted_OnTheLastStep() {
    var tracked = new List<string>();

    var tour = MenuTourTests.MakeTour(new FakeMenuTourStore(), tracked: tracked);

    tour.ReportShown();
    tour.ReportStats(MenuTourTests.StatsWith(1));
    tour.Next();
    tour.Next();
    tour.Next();
    tour.Close();

    Assert.Equal(
      ["tour_started", "tour_finished completed=true leftMenu=false step=\"dashboard\""],
      tracked
    );
  }

  [Fact]
  public void Close_TracksTheTourDismissed_OnAnEarlierStep() {
    var tracked = new List<string>();

    var tour = MenuTourTests.MakeTour(new FakeMenuTourStore(), tracked: tracked);

    tour.ReportShown();
    tour.Next();
    tour.Close();

    // Further presses track nothing more.
    tour.Close();

    Assert.Equal(
      ["tour_started", "tour_finished completed=false leftMenu=false step=\"menuVisibility\""],
      tracked
    );
  }

  [Fact]
  public void OnMoreActionsOpened_TracksTheTourCompleted_OnTheDashboardStep() {
    var tracked = new List<string>();

    var tour = MenuTourTests.MakeTour(new FakeMenuTourStore(), tracked: tracked);

    tour.ReportShown();
    tour.ReportStats(MenuTourTests.StatsWith(1));
    tour.Next();
    tour.Next();
    tour.Next();
    tour.OnMoreActionsOpened();

    Assert.Equal(
      ["tour_started", "tour_finished completed=true leftMenu=false step=\"dashboard\""],
      tracked
    );
  }

  [Fact]
  public void OnMainMenuLeft_TracksTheTourLeft_OnceABalloonShowed() {
    var tracked = new List<string>();

    var tour = MenuTourTests.MakeTour(new FakeMenuTourStore(), tracked: tracked);

    tour.ReportShown();
    tour.OnMainMenuLeft();

    Assert.Equal(
      ["tour_started", "tour_finished completed=false leftMenu=true step=\"navigation\""],
      tracked
    );
  }

  private static MenuTour MakeTour(
    FakeMenuTourStore store,
    List<(MenuTourStep, bool)>? published = null,
    List<string>? tracked = null
  ) =>
    new(
      store,
      (step, isLast) => published?.Add((step, isLast)),
      (name, properties) => tracked?.Add(MenuTourTests.FormatEvent(name, properties))
    );

  /// <summary>
  /// Writes a tracked event as its name followed by its properties sorted by key, so a test
  /// asserts the wire format of the tour's events as a list of strings.
  /// Values are written as JSON writes them, so a bool sent as text fails the assertion.
  /// </summary>
  private static string FormatEvent(string name, Dictionary<string, object>? properties) {
    if (properties is null) {
      return name;
    }

    var pairs = properties
      .OrderBy(p => p.Key)
      .Select(p => $"{p.Key}={MenuTourTests.FormatValue(p.Value)}");

    return $"{name} {string.Join(" ", pairs)}";
  }

  private static string FormatValue(object value) =>
    value switch {
      bool flag => flag ? "true" : "false",
      string text => $"\"{text}\"",
      _ => $"{value}"
    };

  private static CreatorStats StatsWith(int screenshotsCount) =>
    new() {
      ScreenshotsCount = screenshotsCount
    };
}
