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
  public void IsNetworkError_TrueForHttpAndPreloadErrors_FalseOtherwise() {
    Assert.True(SlideshowConductor.IsNetworkError(new HttpNetworkException("1", "boom")));
    Assert.True(SlideshowConductor.IsNetworkError(new ImagePreloadFailedException("url")));
    Assert.False(SlideshowConductor.IsNetworkError(new InvalidOperationException()));
  }

  [Fact]
  public void ShouldRefreshOnReturnToMenu_OnlyWhenReturningFromAnotherMode() {
    // A Theory with [InlineData(GameMode...)] cannot be used here: xUnit's discovery resolves the
    // engine-bound Game assembly to parse enum values out of the attribute blob, which fails
    // off-engine. GameMode in the test body is fine.
    Assert.True(
      SlideshowConductor.ShouldRefreshOnReturnToMenu(GameMode.Game, GameMode.MainMenu)
    );

    Assert.True(
      SlideshowConductor.ShouldRefreshOnReturnToMenu(GameMode.Editor, GameMode.MainMenu)
    );

    Assert.False(
      SlideshowConductor.ShouldRefreshOnReturnToMenu(GameMode.MainMenu, GameMode.MainMenu)
    );

    Assert.False(
      SlideshowConductor.ShouldRefreshOnReturnToMenu(GameMode.MainMenu, GameMode.Game)
    );
  }

  // NEXT

  [Fact]
  public async Task Next_FirstAdvance_PublishesScreenshot_RecordsView_AndSettlesTheLock() {
    var screenshots = new Queue<Screenshot>([
      SlideshowConductorTests.MakeScreenshot("s0"),
      SlideshowConductorTests.MakeScreenshot("s1")
    ]);

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

    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);
    Assert.False(sink.LastHasPrevious);

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
    var screenshots = new Queue<Screenshot>([
      SlideshowConductorTests.MakeScreenshot("s0"),
      SlideshowConductorTests.MakeScreenshot("s1")
    ]);

    var preloadGate = new TaskCompletionSource<object?>();
    var preloadCount = 0;

    // Gate the second preload, which is the background prefetch's image.
    var preloader = new FakePreloader {
      PreloadImpl = _ => ++preloadCount == 2 ? preloadGate.Task : Task.CompletedTask
    };

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () => Task.FromResult(screenshots.Dequeue()),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View())
    };

    var sink = new FakeSlideshowPresentationSink();

    var conductor =
      SlideshowConductorTests.CreateConductor(api: api, preloader: preloader, sink: sink);

    var nextTask = conductor.Next();

    // The screenshot is published immediately, but the lock is still held through the prefetch.
    Assert.Equal("s0", sink.LastPublishedScreenshot!.Id);
    Assert.Equal([false, false], sink.CanAdvanceLog);
    Assert.False(nextTask.IsCompleted);

    preloadGate.SetResult(null);

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
      log: new FakeModLog { ErrorRecoverableImpl = logged.Add },
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
      log: new FakeModLog { ErrorSilentImpl = silentLogged.Add },
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
    var screenshots = new Queue<Screenshot>([
      SlideshowConductorTests.MakeScreenshot("s0"),
      SlideshowConductorTests.MakeScreenshot("s1")
    ]);

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
    var screenshots = new Queue<Screenshot>([
      SlideshowConductorTests.MakeScreenshot("s0"),
      SlideshowConductorTests.MakeScreenshot("s1"),
      SlideshowConductorTests.MakeScreenshot("s2")
    ]);

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
    Assert.False(sink.LastHasPrevious);

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
    // >= 2.
    await conductor.Next();
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
    var screenshots = new Queue<Screenshot>([
      SlideshowConductorTests.MakeScreenshot("s0", likesCount: 5),
      SlideshowConductorTests.MakeScreenshot("s1")
    ]);

    var preloadGate = new TaskCompletionSource<object?>();
    var preloadCount = 0;

    var preloader = new FakePreloader {
      PreloadImpl = _ => ++preloadCount == 2 ? preloadGate.Task : Task.CompletedTask
    };

    var likeCalls = new List<(string Id, bool Liked)>();

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () => Task.FromResult(screenshots.Dequeue()),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View()),
      LikeScreenshotImpl = (id, liked) => {
        likeCalls.Add((id, liked));

        return Task.FromResult(new View());
      }
    };

    var sink = new FakeSlideshowPresentationSink();

    var conductor =
      SlideshowConductorTests.CreateConductor(api: api, preloader: preloader, sink: sink);

    // Suspends in the background prefetch (Prefetching phase): the current screenshot is settled.
    var nextTask = conductor.Next();

    await conductor.Like();

    // The like acted on the settled current screenshot even while the prefetch was in flight.
    Assert.Equal(("s0", true), Assert.Single(likeCalls));

    preloadGate.SetResult(null);

    await nextTask;
  }

  [Fact]
  public async Task Like_DuringNavigation_IsBlocked() {
    var screenshots = new Queue<Screenshot>([
      SlideshowConductorTests.MakeScreenshot("s0"),
      SlideshowConductorTests.MakeScreenshot("s1"),
      SlideshowConductorTests.MakeScreenshot("s2")
    ]);

    var preloadGate = new TaskCompletionSource<object?>();
    var preloadCount = 0;

    // Gate the fourth preload, which is the scrollback re-preload during the Previous navigation.
    var preloader = new FakePreloader {
      PreloadImpl = _ => ++preloadCount == 4 ? preloadGate.Task : Task.CompletedTask
    };

    var likeCalls = new List<(string Id, bool Liked)>();

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () => Task.FromResult(screenshots.Dequeue()),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View()),
      LikeScreenshotImpl = (id, liked) => {
        likeCalls.Add((id, liked));

        return Task.FromResult(new View());
      }
    };

    var sink = new FakeSlideshowPresentationSink();

    var conductor =
      SlideshowConductorTests.CreateConductor(api: api, preloader: preloader, sink: sink);

    await conductor.Next();
    await conductor.Next();

    // Suspends mid-navigation (Navigating phase): the current screenshot may be swapped out.
    var previousTask = conductor.Previous();

    await conductor.Like();

    Assert.Empty(likeCalls);

    preloadGate.SetResult(null);

    await previousTask;
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
        settings: new FakeSlideshowSettings { SaveDirectory = directory },
        log: new FakeModLog {
          ErrorRecoverableImpl = recoverable.Add, ErrorLocalizedImpl = localizedErrors.Add
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
      log: new FakeModLog { ErrorLocalizedImpl = localizedErrors.Add },
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
      log: new FakeModLog { ErrorRecoverableImpl = recoverable.Add },
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
    Assert.Equal(0, sink.RefreshCount);
  }

  [Fact]
  public async Task Report_WhenConfirmed_Reports_ShowsSuccess_AndRefreshes() {
    var reported = new List<string>();
    var api = SlideshowConductorTests.ReportableApi(reported);

    var sink = new FakeSlideshowPresentationSink { ConfirmReportImpl = _ => Task.FromResult(true) };
    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    await conductor.Next();
    await conductor.Report();

    Assert.Equal("s0", Assert.Single(reported));
    Assert.Equal(1, sink.ReportSuccessCount);
    Assert.Equal(1, sink.RefreshCount);
    Assert.Empty(sink.ShownErrors);
  }

  [Fact]
  public async Task Report_WhenConfirmedAndApiFails_ShowsError_WithoutSuccessOrRefresh() {
    var n = 0;

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl =
        () => Task.FromResult(SlideshowConductorTests.MakeScreenshot($"s{n++}")),
      MarkScreenshotViewedImpl = _ => Task.FromResult(new View()),
      ReportScreenshotImpl = _ => Task.FromException<Screenshot>(new HttpNetworkException("1", "x"))
    };

    var sink = new FakeSlideshowPresentationSink { ConfirmReportImpl = _ => Task.FromResult(true) };
    var conductor = SlideshowConductorTests.CreateConductor(api: api, sink: sink);

    await conductor.Next();
    await conductor.Report();

    Assert.Single(sink.ShownErrors);
    Assert.Equal(0, sink.ReportSuccessCount);
    Assert.Equal(0, sink.RefreshCount);
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
    var sink = new FakeSlideshowPresentationSink { ConfirmReportImpl = _ => Task.FromResult(true) };

    var conductor = SlideshowConductorTests.CreateConductor(
      api: api,
      log: new FakeModLog { ErrorRecoverableImpl = recoverable.Add },
      sink: sink
    );

    await conductor.Next();
    await conductor.Report();

    Assert.IsType<InvalidOperationException>(Assert.Single(recoverable));
    Assert.Empty(sink.ShownErrors);
    Assert.Equal(0, sink.ReportSuccessCount);
  }

  // GAME MODE

  [Fact]
  public void OnGameModeChanged_ReturningToMainMenu_RequestsRefresh() {
    var sink = new FakeSlideshowPresentationSink();
    var conductor = SlideshowConductorTests.CreateConductor(sink: sink);

    conductor.OnGameModeChanged(GameMode.Game);
    conductor.OnGameModeChanged(GameMode.MainMenu);

    Assert.Equal(1, sink.RefreshCount);
  }

  [Fact]
  public void OnGameModeChanged_OnBoot_DoesNotRefresh() {
    // The previous-mode baseline is seeded to MainMenu, so the first MainMenu is not a return.
    var sink = new FakeSlideshowPresentationSink();
    var conductor = SlideshowConductorTests.CreateConductor(sink: sink);

    conductor.OnGameModeChanged(GameMode.MainMenu);

    Assert.Equal(0, sink.RefreshCount);
  }

  [Fact]
  public void OnGameModeChanged_EnteringGame_DoesNotRefresh() {
    var sink = new FakeSlideshowPresentationSink();
    var conductor = SlideshowConductorTests.CreateConductor(sink: sink);

    conductor.OnGameModeChanged(GameMode.Game);

    Assert.Equal(0, sink.RefreshCount);
  }

  // HELPERS

  /// <summary>
  /// Builds a conductor with default fakes, letting each test override only the collaborators it
  /// exercises.
  /// </summary>
  private static SlideshowConductor CreateConductor(
    IHallOfFameApi? api = null,
    IImagePreloader? preloader = null,
    IModLog? log = null,
    ISlideshowSettings? settings = null,
    ISlideshowPresentationSink? sink = null
  ) => new(
    api ?? new FakeApi(),
    preloader ?? new FakePreloader(),
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
