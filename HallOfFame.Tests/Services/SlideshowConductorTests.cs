using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using Game;
using Game.UI.Localization;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Logging;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using HallOfFame.Tests.Logging;
using Xunit;

namespace HallOfFame.Tests.Services;

/// <summary>
/// Exercises the conductor as an integration unit: the real leaves (carousel, navigation, liker,
/// view recorder, exporter) wired to fake boundaries, driven through the <see cref="Task"/> entry
/// points.
/// This is the test surface the extraction exists to create: the sequencing that used to live
/// untested in the engine-bound slideshow system.
/// </summary>
public sealed class SlideshowConductorTests {
  // PURE HELPERS

  [Fact]
  public void IsNetworkError_TrueForHttp_FalseOtherwise() {
    Assert.True(SlideshowConductor.IsNetworkError(new HttpNetworkException("1", "boom")));
    Assert.False(SlideshowConductor.IsNetworkError(new InvalidOperationException()));
  }

  // NEXT

  [Fact]
  public async Task FirstAdvance_PublishesScreenshot_RecordsView_AndSettlesTheLock() {
    var screenshots = new Queue<Screenshot>(
      [SlideshowConductorTests.MakeScreenshot("s0"), SlideshowConductorTests.MakeScreenshot("s1")]
    );

    var viewed = new List<string>();

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () => Task.FromResult(screenshots.Dequeue()),
      MarkScreenshotViewedImpl = id => {
        viewed.Add(id);

        return Task.FromResult(new View());
      }
    };

    var sink = new FakeSlideshowPresentationSink();
    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    // The mount report is how the first screenshot reaches the screen: it serves the load owed from
    // construction, which is the apply path every later Next shares.
    await conductor.OnSlideshowMounted();

    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);

    // First screenshot has no previous; the prefetched look-ahead becomes its next neighbor.
    Assert.Null(sink.LastPublishedPrevious);
    Assert.Equal("s1", sink.LastPublishedNext!.Id);

    // The lock is taken (false) for the navigation, stays held (false) for the prefetch, then
    // released (true) once the prefetch settles.
    Assert.Equal([false, false, true], sink.CanAdvanceLog);

    // The displayed screenshot is recorded as viewed; the prefetched look-ahead is not.
    Assert.Equal(["s0"], viewed);

    // The load-error binding is cleared on a successful apply.
    Assert.Equal([null], sink.PublishedLoadErrors);
  }

  [Fact]
  public async Task Next_GatedPrefetch_KeepsLockHeld_UntilPrefetchSettles() {
    var fetchGate = new TaskCompletionSource<Screenshot>();
    var fetchCount = 0;

    // Gate the second fetch, which is the background prefetch's look-ahead.
    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () =>
        ++fetchCount == 1
          ? Task.FromResult(SlideshowConductorTests.MakeScreenshot("s0"))
          : fetchGate.Task,
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View())
    };

    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    var nextTask = conductor.Next();

    // The screenshot is published immediately, but the lock is still held through the prefetch.
    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);
    Assert.Equal([false, false], sink.CanAdvanceLog);
    Assert.False(nextTask.IsCompleted);

    fetchGate.SetResult(SlideshowConductorTests.MakeScreenshot("s1"));

    await nextTask;

    Assert.Equal([false, false, true], sink.CanAdvanceLog);
  }

  [Fact]
  public async Task Next_NetworkLoadError_PublishesLoadError_AndReleasesTheLock() {
    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl =
        () => Task.FromException<Screenshot>(new HttpNetworkException("1", "boom"))
    };

    var sink = new FakeSlideshowPresentationSink();
    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    await conductor.Next();

    // No screenshot displayed; the error is surfaced inline and the lock is released.
    Assert.Null(sink.LastPublishedScreenshot);
    Assert.NotNull(Assert.Single(sink.PublishedLoadErrors));
    Assert.Equal([false, true], sink.CanAdvanceLog);
  }

  [Fact]
  public async Task Next_NonNetworkLoadError_LogsRecoverable_AndReleasesTheLock() {
    var logged = new List<Exception>();

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl =
        () => Task.FromException<Screenshot>(new InvalidOperationException("boom"))
    };

    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(
      api: api,
      log: new FakeModLog {
        ErrorRecoverableImpl = logged.Add
      },
      sink: sink
    );

    await conductor.Next();

    Assert.IsType<InvalidOperationException>(Assert.Single(logged));
    Assert.Empty(sink.PublishedLoadErrors);
    Assert.Equal([false, true], sink.CanAdvanceLog);
  }

  [Fact]
  public async Task Next_PrefetchError_StillPublishesScreenshot_AndReleasesTheLock() {
    var calls = 0;

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () => ++calls == 1
        ? Task.FromResult(SlideshowConductorTests.MakeScreenshot("s0"))
        : Task.FromException<Screenshot>(new HttpNetworkException("1", "boom")),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View())
    };

    var silentLogged = new List<Exception>();
    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(
      api: api,
      log: new FakeModLog {
        ErrorSilentImpl = silentLogged.Add
      },
      sink: sink
    );

    await conductor.Next();

    // The displayed screenshot is unaffected by a failed background prefetch, and the lock still
    // settles to released.
    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);
    Assert.Equal([false, false, true], sink.CanAdvanceLog);
    Assert.IsType<HttpNetworkException>(Assert.Single(silentLogged));
  }

  // PREVIOUS

  [Fact]
  public async Task Previous_AtFirstScreenshot_IsANoOp() {
    var screenshots = new Queue<Screenshot>(
      [SlideshowConductorTests.MakeScreenshot("s0"), SlideshowConductorTests.MakeScreenshot("s1")]
    );

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () => Task.FromResult(screenshots.Dequeue()),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View())
    };

    var sink = new FakeSlideshowPresentationSink();
    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    await conductor.Next();
    sink.CanAdvanceLog.Clear();

    await conductor.Previous();

    // No navigation happened: the lock was never touched, and the screenshot is unchanged.
    Assert.Empty(sink.CanAdvanceLog);
    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);
  }

  [Fact]
  public async Task Previous_MovesBack_PublishesPrior_WithoutPrefetchOrView() {
    var screenshots = new Queue<Screenshot>(
      [
        SlideshowConductorTests.MakeScreenshot("s0"),
        SlideshowConductorTests.MakeScreenshot("s1"),
        SlideshowConductorTests.MakeScreenshot("s2")
      ]
    );

    var viewed = new List<string>();

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () => Task.FromResult(screenshots.Dequeue()),
      MarkScreenshotViewedImpl = id => {
        viewed.Add(id);

        return Task.FromResult(new View());
      }
    };

    var sink = new FakeSlideshowPresentationSink();
    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    await conductor.Next();
    await conductor.Next();

    viewed.Clear();
    sink.CanAdvanceLog.Clear();

    await conductor.Previous();

    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);

    // Back at the first screenshot: no previous, and s1 is the look-ahead sitting just ahead.
    Assert.Null(sink.LastPublishedPrevious);
    Assert.Equal("s1", sink.LastPublishedNext!.Id);

    // Scrollback takes the lock then releases it right away, with no background prefetch.
    Assert.Equal([false, true], sink.CanAdvanceLog);

    // Moving onto an already-seen screenshot records no view.
    Assert.Empty(viewed);
  }

  // VIEW RECORDING

  /// <summary>
  /// A scripted walk goes forward into fresh territory, scrolls back over already-seen screenshots,
  /// then forward again past them.
  /// The conductor records every display and leans on the recorder's at-most-once dedupe rather
  /// than pre-filtering, so each distinct screenshot is counted exactly once, on its first display.
  /// This is the integration-level counterpart to the recorder's own dedupe unit tests.
  /// </summary>
  [Fact]
  public async Task ViewRecording_OverScriptedWalk_CountsEachFirstDisplayOnce() {
    var counter = 0;

    var viewed = new List<string>();

    // Distinct screenshots on every fetch keep the carousel's look-ahead dedupe from spinning.
    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl =
        () => Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{counter++}")),
      MarkScreenshotViewedImpl = id => {
        viewed.Add(id);

        return Task.FromResult(new View());
      }
    };

    var conductor = SlideshowConductorTests.CreateConductor(api: api);

    // Three forward steps before scrolling back twice: two Previous moves need the cursor at index
    // >= 2. The mount report is the first of the three, as it is in the menu.
    await conductor.OnSlideshowMounted();
    await conductor.Next();
    await conductor.Next();
    await conductor.Previous();
    await conductor.Previous();
    await conductor.Next();
    await conductor.Next();
    await conductor.Next();

    // s1 and s2 are re-displayed during the forward replay after scrollback, yet never re-counted;
    // s3 is counted only when the replay crosses into never-seen territory.
    Assert.Equal(["s0", "s1", "s2", "s3"], viewed);
  }

  // LIKE

  [Fact]
  public async Task Like_DuringBackgroundPrefetch_IsAllowed() {
    var fetchGate = new TaskCompletionSource<Screenshot>();
    var fetchCount = 0;

    var likeCalls = new List<(string Id, bool Liked)>();

    // Gate the second fetch (the background prefetch's look-ahead).
    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () =>
        ++fetchCount == 1
          ? Task.FromResult(SlideshowConductorTests.MakeScreenshot("s0", likesCount: 5))
          : fetchGate.Task,
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View()),
      LikeScreenshotImpl = (id, liked) => {
        likeCalls.Add((id, liked));

        return Task.FromResult(new View());
      }
    };

    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    // Suspends in the background prefetch (Prefetching phase): the current screenshot is settled.
    var nextTask = conductor.Next();

    await conductor.Like();

    // The like acted on the settled current screenshot even while the prefetch was in flight.
    Assert.Equal(("s0", true), Assert.Single(likeCalls));

    fetchGate.SetResult(SlideshowConductorTests.MakeScreenshot("s1"));

    await nextTask;
  }

  [Fact]
  public async Task Like_DuringNavigation_IsBlocked() {
    var fetchGate = new TaskCompletionSource<Screenshot>();
    var fetchCount = 0;

    var likeCalls = new List<(string Id, bool Liked)>();

    // Gate the first fetch so the conductor stays mid-navigation (Navigating phase) while it is
    // pending; the later ungated fetches serve the look-ahead.
    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () =>
        ++fetchCount == 1
          ? fetchGate.Task
          : Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{fetchCount - 1}")),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View()),
      LikeScreenshotImpl = (id, liked) => {
        likeCalls.Add((id, liked));

        return Task.FromResult(new View());
      }
    };

    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    // Suspends mid-navigation (Navigating phase) on the gated fetch, before any screenshot settles.
    var nextTask = conductor.Next();

    await conductor.Like();

    Assert.Empty(likeCalls);

    fetchGate.SetResult(SlideshowConductorTests.MakeScreenshot("s0"));

    await nextTask;
  }

  // SAVE

  [Fact]
  public async Task Save_WithNoCurrentScreenshot_IsANoOp() {
    var sink = new FakeSlideshowPresentationSink();
    var conductor = SlideshowConductorTests.CreateConductor(sink: sink);

    await conductor.Save();

    Assert.Empty(sink.SavingLog);
  }

  [Fact]
  public async Task Save_WhileAlreadySaving_IsIgnored() {
    var downloadGate = new TaskCompletionSource<byte[]>();
    var downloadCalls = 0;

    var n = 0;

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl =
        () => Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{n++}")),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View()),
      DownloadImageImpl = _ => {
        downloadCalls++;

        return downloadGate.Task;
      }
    };

    var sink = new FakeSlideshowPresentationSink();
    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    await conductor.Next();

    // First save takes the lock and suspends on the gated download.
    var firstSave = conductor.Save();

    Assert.Equal([true], sink.SavingLog);

    // Second save is ignored while the first is in flight: no second download.
    await conductor.Save();

    Assert.Equal(1, downloadCalls);

    // Release with a failure to avoid a real disk write; the save still settles the indicator.
    downloadGate.SetException(new HttpNetworkException("1", "boom"));

    await firstSave;

    Assert.Equal([true, false], sink.SavingLog);
  }

  [Fact]
  public async Task Save_Success_TogglesSaving_AndWritesAFile() {
    var n = 0;

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl =
        () => Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{n++}")),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View()),
      DownloadImageImpl = _ => Task.FromResult(new byte[] { 1, 2, 3 })
    };

    var directory = SlideshowConductorTests.CreateTempDirectory();

    try {
      var recoverable = new List<Exception>();
      var localizedErrors = new List<LocalizedString>();
      var sink = new FakeSlideshowPresentationSink();

      var conductor = SlideshowConductorTests.CreateConductor(
        api: api,
        settings: new FakeSlideshowSettings {
          SaveDirectory = directory
        },
        log: new FakeModLog {
          ErrorRecoverableImpl = recoverable.Add,
          ErrorLocalizedImpl = localizedErrors.Add
        },
        sink: sink
      );

      await conductor.Next();
      await conductor.Save();

      Assert.Equal([true, false], sink.SavingLog);
      Assert.Empty(recoverable);
      Assert.Empty(localizedErrors);
      Assert.NotEmpty(Directory.GetFiles(directory));
    }
    finally {
      Directory.Delete(directory, recursive: true);
    }
  }

  [Fact]
  public async Task Save_NetworkError_LogsTheUserFriendlyMessage() {
    var n = 0;

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl =
        () => Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{n++}")),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View()),
      DownloadImageImpl = _ => Task.FromException<byte[]>(new HttpNetworkException("1", "boom"))
    };

    var localizedErrors = new List<LocalizedString>();
    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(
      api: api,
      log: new FakeModLog {
        ErrorLocalizedImpl = localizedErrors.Add
      },
      sink: sink
    );

    await conductor.Next();
    await conductor.Save();

    // The network save error is logged (and surfaced in-game by the real logger), not shown through
    // the like/report dialog.
    Assert.Single(localizedErrors);
    Assert.Empty(sink.ShownErrors);
    Assert.Equal([true, false], sink.SavingLog);
  }

  [Fact]
  public async Task Save_NonNetworkError_LogsRecoverable() {
    var n = 0;

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl =
        () => Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{n++}")),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View()),
      DownloadImageImpl = _ => Task.FromException<byte[]>(new InvalidOperationException("boom"))
    };

    var recoverable = new List<Exception>();
    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(
      api: api,
      log: new FakeModLog {
        ErrorRecoverableImpl = recoverable.Add
      },
      sink: sink
    );

    await conductor.Next();
    await conductor.Save();

    Assert.IsType<InvalidOperationException>(Assert.Single(recoverable));
    Assert.Equal([true, false], sink.SavingLog);
  }

  // REPORT

  [Fact]
  public async Task Report_WithNoCurrentScreenshot_IsANoOp() {
    var confirmCalls = 0;

    var sink = new FakeSlideshowPresentationSink {
      ConfirmReportImpl = _ => {
        confirmCalls++;

        return Task.FromResult(true);
      }
    };

    var conductor = SlideshowConductorTests.CreateConductor(sink: sink);

    await conductor.Report();

    Assert.Equal(0, confirmCalls);
    Assert.Equal(0, sink.ReportSuccessCount);
  }

  [Fact]
  public async Task Report_WhenDeclined_DoesNotReport() {
    var reported = new List<string>();
    var api = SlideshowConductorTests.ReportableApi(reported);

    var sink = new FakeSlideshowPresentationSink {
      ConfirmReportImpl = _ => Task.FromResult(false)
    };
    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    await conductor.Next();
    await conductor.Report();

    Assert.Empty(reported);
    Assert.Equal(0, sink.ReportSuccessCount);

    // The declined screenshot stays on screen.
    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);
  }

  [Fact]
  public async Task Report_WhenConfirmed_Reports_ShowsSuccess_AndMovesOff() {
    var reported = new List<string>();
    var api = SlideshowConductorTests.ReportableApi(reported);

    var sink = new FakeSlideshowPresentationSink {
      ConfirmReportImpl = _ => Task.FromResult(true)
    };
    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    await conductor.Next();
    await conductor.Report();

    Assert.Equal("s0", Assert.Single(reported));
    Assert.Equal(1, sink.ReportSuccessCount);
    Assert.Empty(sink.ShownErrors);

    // The reported screenshot does not stay on screen: the slideshow advances onto the look-ahead.
    Assert.Equal("s1", sink.LastPublishedScreenshot!.Id);
  }

  [Fact]
  public async Task Report_WhenConfirmedAndApiFails_ShowsError_WithoutSuccessOrAdvancing() {
    var n = 0;

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl =
        () => Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{n++}")),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View()),
      ReportScreenshotImpl = _ => Task.FromException<Screenshot>(new HttpNetworkException("1", "x"))
    };

    var sink = new FakeSlideshowPresentationSink {
      ConfirmReportImpl = _ => Task.FromResult(true)
    };
    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    await conductor.Next();
    await conductor.Report();

    Assert.Single(sink.ShownErrors);
    Assert.Equal(0, sink.ReportSuccessCount);

    // A failed report leaves the screenshot in place.
    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);
  }

  [Fact]
  public async Task Report_WhenConfirmedAndUnexpectedError_LogsRecoverable() {
    var n = 0;

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl =
        () => Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{n++}")),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View()),
      ReportScreenshotImpl =
        _ => Task.FromException<Screenshot>(new InvalidOperationException("boom"))
    };

    var recoverable = new List<Exception>();
    var sink = new FakeSlideshowPresentationSink {
      ConfirmReportImpl = _ => Task.FromResult(true)
    };

    var conductor = SlideshowConductorTests.CreateConductor(
      api: api,
      log: new FakeModLog {
        ErrorRecoverableImpl = recoverable.Add
      },
      sink: sink
    );

    await conductor.Next();
    await conductor.Report();

    Assert.IsType<InvalidOperationException>(Assert.Single(recoverable));
    Assert.Empty(sink.ShownErrors);
    Assert.Equal(0, sink.ReportSuccessCount);
  }

  // GAME MODE AND THE MOUNT HANDSHAKE

  [Fact]
  public async Task OnSlideshowMounted_FirstMount_LoadsTheFirstScreenshot() {
    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(
      api: SlideshowConductorTests.SequentialApi(),
      sink: sink
    );

    await conductor.OnSlideshowMounted();

    // Nothing is published before the UI says it can display it, and the first mount is what
    // releases that first load.
    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);
  }

  [Fact]
  public async Task OnSlideshowMounted_RepeatedMount_KeepsTheSameScreenshot() {
    var fetches = 0;
    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(
      api: SlideshowConductorTests.SequentialApi(() => fetches++),
      sink: sink
    );

    await conductor.OnSlideshowMounted();

    var fetchesAfterFirstMount = fetches;

    await conductor.OnSlideshowMounted();

    // A remount is not a request for a new screenshot: a menu sub-screen round trip, and a UI
    // reload in development, must both hold the screenshot already on screen.
    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);
    Assert.Equal(fetchesAfterFirstMount, fetches);
  }

  [Fact]
  public async Task OnSlideshowMounted_AfterReturnToMainMenu_LoadsAFreshScreenshot() {
    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(
      api: SlideshowConductorTests.SequentialApi(),
      sink: sink
    );

    await conductor.OnSlideshowMounted();

    conductor.OnGameModeChanged(GameMode.Game);
    conductor.OnGameModeChanged(GameMode.MainMenu);

    await conductor.OnSlideshowMounted();

    Assert.Equal("s1", sink.LastPublishedScreenshot!.Id);

    // Each game-mode change mirrors the main-menu flag: false entering the game, true on return.
    Assert.Equal([false, true], sink.InMainMenuLog);
  }

  [Fact]
  public async Task OnSlideshowMounted_BeforeTheReturnIsAnnounced_LoadsAFreshScreenshot() {
    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(
      api: SlideshowConductorTests.SequentialApi(),
      sink: sink
    );

    await conductor.OnSlideshowMounted();

    conductor.OnGameModeChanged(GameMode.Game);

    // The engine activates the menu UI before it announces the return, and the debt was incurred on
    // the way out, so the mount report settles it without waiting for the mode change.
    await conductor.OnSlideshowMounted();

    Assert.Equal("s1", sink.LastPublishedScreenshot!.Id);
  }

  [Fact]
  public async Task OnGameModeChanged_WhenTheLockIsHeld_RefreshesOnceThePrefetchReleasesIt() {
    var prefetchGate = new TaskCompletionSource<Screenshot>();
    var fetches = 0;
    var sink = new FakeSlideshowPresentationSink();

    // Gate the look-ahead prefetch, so the navigation lock stays held after the first screenshot is
    // published.
    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () => ++fetches switch {
        1 => Task.FromResult(SlideshowConductorTests.MakeScreenshot("s0")),
        2 => prefetchGate.Task,
        _ => Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{fetches}"))
      },
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View())
    };

    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    var firstMount = conductor.OnSlideshowMounted();

    conductor.OnGameModeChanged(GameMode.Game);
    conductor.OnGameModeChanged(GameMode.MainMenu);

    // The lock is still held by the gated prefetch, so this refresh is dropped. The owed refresh
    // must outlive the drop, which is why it is cleared once a screenshot is applied and not when
    // it is requested.
    await conductor.OnSlideshowMounted();

    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);

    prefetchGate.SetResult(SlideshowConductorTests.MakeScreenshot("s1"));

    await firstMount;

    // Releasing the lock is what serves what was owed: the UI sends no further mount report, so the
    // prefetch's own completion has to be the second chance.
    Assert.Equal("s1", sink.LastPublishedScreenshot!.Id);
  }

  [Fact]
  public async Task ApplyStep_WhenTheLoadLandsUnmounted_SpendsNoViewAndKeepsTheLoadOwed() {
    var fetchGate = new TaskCompletionSource<Screenshot>();
    var viewed = new List<string>();
    var fetches = 0;
    var sink = new FakeSlideshowPresentationSink();

    // Gate the very first fetch, so the load is still in flight when the game mode changes.
    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () => ++fetches switch {
        1 => fetchGate.Task,
        _ => Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{fetches - 1}"))
      },
      MarkScreenshotViewedImpl = id => {
        viewed.Add(id);

        return Task.FromResult(new View());
      }
    };

    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    var firstMount = conductor.OnSlideshowMounted();

    // The user starts a game before the gated load lands, tearing the menu UI down under it.
    conductor.OnGameModeChanged(GameMode.Game);

    fetchGate.SetResult(SlideshowConductorTests.MakeScreenshot("s0"));

    await firstMount;

    // The load landed with nothing on screen, so it may neither spend a view on a screenshot
    // nobody saw nor settle the debt it was meant to pay.
    Assert.Empty(viewed);

    // Back in the menu: the debt survived, so the mount report serves a screenshot of its own.
    await conductor.OnSlideshowMounted();

    Assert.Equal("s1", sink.LastPublishedScreenshot!.Id);
    Assert.Equal(["s1"], viewed);
  }

  [Fact]
  public async Task OnGameModeChanged_WhenTheSlideshowIsUnmounted_SpendsNothing() {
    var prefetchGate = new TaskCompletionSource<Screenshot>();
    var viewed = new List<string>();
    var fetches = 0;
    var sink = new FakeSlideshowPresentationSink();

    // Gate the look-ahead prefetch, so the navigation lock stays held after the first screenshot is
    // published.
    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () => ++fetches switch {
        1 => Task.FromResult(SlideshowConductorTests.MakeScreenshot("s0")),
        2 => prefetchGate.Task,
        _ => Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{fetches}"))
      },
      MarkScreenshotViewedImpl = id => {
        viewed.Add(id);

        return Task.FromResult(new View());
      }
    };

    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    var firstMount = conductor.OnSlideshowMounted();

    // A refresh comes to be owed by the return to the menu, and the mount report that would serve
    // it is turned away while the gated prefetch holds the navigation lock.
    conductor.OnGameModeChanged(GameMode.Game);
    conductor.OnGameModeChanged(GameMode.MainMenu);

    await conductor.OnSlideshowMounted();

    // The user starts another game, tearing the menu UI down with the refresh still owed.
    conductor.OnGameModeChanged(GameMode.Game);

    prefetchGate.SetResult(SlideshowConductorTests.MakeScreenshot("s1"));

    await firstMount;

    // Freeing the lock is an opportunity to serve the owed refresh, but there is nothing on screen
    // to show it, so neither a request nor a view is spent on a screenshot nobody sees.
    Assert.Equal(["s0"], viewed);
    Assert.Equal(2, fetches);
    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);
  }

  [Fact]
  public async Task OnGameModeChanged_ReturnToMenu_WhenTheMountServed_LoadsNothingMore() {
    var fetches = 0;
    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(
      api: SlideshowConductorTests.SequentialApi(() => fetches++),
      sink: sink
    );

    // The user starts a game with the first load still owed, which is what happens when the
    // slideshow was never mounted that session (the setting was off) or its first load failed.
    conductor.OnGameModeChanged(GameMode.Game);

    // The engine activates the menu UI before it announces the return, so the mount report is what
    // serves the owed load.
    await conductor.OnSlideshowMounted();

    var fetchesAfterMount = fetches;

    conductor.OnGameModeChanged(GameMode.MainMenu);

    // The debt was settled by the mount, so the mode change must not owe a second one: one return
    // to the menu publishes exactly one screenshot.
    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);
    Assert.Equal(fetchesAfterMount, fetches);
  }

  [Fact]
  public async Task OnGameModeChanged_EnteringGame_DoesNotRefresh() {
    var sink = new FakeSlideshowPresentationSink();

    var conductor = SlideshowConductorTests.CreateConductor(
      api: SlideshowConductorTests.SequentialApi(),
      sink: sink
    );

    await conductor.OnSlideshowMounted();

    conductor.OnGameModeChanged(GameMode.Game);

    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);
    Assert.Equal([false], sink.InMainMenuLog);
  }

  // HELPERS

  /// <summary>
  /// Builds a conductor with default fakes, letting each test override only the collaborators it
  /// exercises.
  /// </summary>
  private static SlideshowConductor CreateConductor(
    IHallOfFameApi? api = null,
    IModLog? log = null,
    ISlideshowSettings? settings = null,
    ISlideshowPresentationSink? sink = null
  ) =>
    new(
      api ?? new FakeApi(),
      log ?? new FakeModLog(),
      settings ?? new FakeSlideshowSettings(),
      sink ?? new FakeSlideshowPresentationSink()
    );

  /// <summary>
  /// An API that serves distinct screenshots (the first being "s0") and records the IDs passed to
  /// <c>ReportScreenshot</c>, for the report-flow tests that only need the current screenshot.
  /// Distinct IDs keep the carousel's look-ahead dedupe from spinning.
  /// </summary>
  private static FakeApi ReportableApi(List<string> reported) {
    var n = 0;

    return new FakeApi {
      GetRandomScreenshotWeightedImpl =
        () => Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{n++}")),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View()),
      ReportScreenshotImpl = id => {
        reported.Add(id);

        return Task.FromResult(SlideshowConductorTests.MakeScreenshot(id));
      }
    };
  }

  /// <summary>
  /// An API that serves distinct screenshots ("s0", "s1", ...), so a test can tell a fresh load
  /// from a screenshot that stayed put.
  /// Distinct IDs keep the carousel's look-ahead dedupe from spinning.
  /// </summary>
  /// <param name="onFetch">Called on each random-screenshot fetch, to count them.</param>
  private static FakeApi SequentialApi(Action? onFetch = null) {
    var n = 0;

    return new FakeApi {
      GetRandomScreenshotWeightedImpl = () => {
        onFetch?.Invoke();

        return Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{n++}"));
      },
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View())
    };
  }

  private static Screenshot MakeScreenshot(string id, bool isLiked = false, int likesCount = 0) =>
    new() {
      Id = id,
      IsLiked = isLiked,
      LikesCount = likesCount,
      ImageUrlFHD = $"https://img/{id}-fhd.jpg",
      ImageUrl4K = $"https://img/{id}-4k.jpg"
    };

  private static string CreateTempDirectory() {
    var path = Path.Combine(Path.GetTempPath(), $"hof-conductor-{Guid.NewGuid():N}");

    Directory.CreateDirectory(path);

    return path;
  }
}
