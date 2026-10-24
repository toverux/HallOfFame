using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using HallOfFame.Tests.Logging;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class DashboardServiceTests {
  [Fact]
  public async Task Open_PublishesLoading_ThenLoadedWithTheCollectionAndStats() {
    var stats = new CreatorStats {
      ScreenshotsCount = 2
    };

    var api = DashboardServiceTests.CreateApi(["a", "b"], stats);
    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    await service.Open();

    Assert.Equal(["Loading", "Loaded:a,b"], sink.Log);
    Assert.Same(stats, sink.LastState.Stats);
    Assert.Null(sink.LastState.Error);
  }

  [Fact]
  public async Task Open_HttpFailure_PublishesTheError_LogsSilently_AndARefreshRetries() {
    var silent = new List<Exception>();
    var recoverable = new List<Exception>();
    var fetchCount = 0;

    var api = new FakeApi {
      GetMyScreenshotsImpl = () => {
        fetchCount++;

        return fetchCount == 1
          ? throw new HttpServerException("42", new HttpQueries.JsonError())
          : Task.FromResult<IReadOnlyList<DashboardScreenshot>>(
            [DashboardServiceTests.MakeScreenshot("a")]
          );
      },
      GetCreatorStatsImpl = () => Task.FromResult(new CreatorStats())
    };

    var log = new FakeModLog {
      ErrorSilentImpl = silent.Add,
      ErrorRecoverableImpl = recoverable.Add
    };

    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, log, sink);

    // Must not throw despite the failed fetch.
    await service.Open();

    Assert.Equal(["Loading", "Error"], sink.Log);
    Assert.Equal(
      $"HallOfFame.Common.ERROR_MESSAGE[{typeof(HttpServerException).FullName}]",
      sink.LastState.Error?.id
    );
    Assert.Single(silent);
    Assert.Empty(recoverable);

    await service.Refresh();

    Assert.Equal(2, fetchCount);
    Assert.Equal(DashboardStatus.Loaded, sink.LastState.Status);
    Assert.Null(sink.LastState.Error);
    Assert.Equal("a", Assert.Single(sink.LastState.Screenshots).Id);
  }

  [Fact]
  public async Task Open_StatsFailure_PublishesTheError() {
    var api = new FakeApi {
      GetMyScreenshotsImpl = () => Task.FromResult<IReadOnlyList<DashboardScreenshot>>([]),
      GetCreatorStatsImpl = () => Task.FromException<CreatorStats>(
        new HttpNetworkException("1", "offline")
      )
    };

    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    await service.Open();

    Assert.Equal(["Loading", "Error"], sink.Log);
  }

  [Fact]
  public async Task Open_UnexpectedFailure_PublishesTheError_AndLogsRecoverably() {
    var recoverable = new List<Exception>();

    var api = new FakeApi {
      GetMyScreenshotsImpl = () => throw new InvalidOperationException("boom"),
      GetCreatorStatsImpl = () => Task.FromResult(new CreatorStats())
    };

    var log = new FakeModLog {
      ErrorRecoverableImpl = recoverable.Add
    };

    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, log, sink);

    await service.Open();

    Assert.Equal(DashboardStatus.Error, sink.LastState.Status);
    Assert.NotNull(sink.LastState.Error);
    Assert.Single(recoverable);
  }

  [Fact]
  public async Task Open_AgainWhileLoading_FetchesOnce() {
    var gate = new TaskCompletionSource<IReadOnlyList<DashboardScreenshot>>();
    var fetchCount = 0;

    var api = new FakeApi {
      GetMyScreenshotsImpl = () => {
        fetchCount++;

        return gate.Task;
      },
      GetCreatorStatsImpl = () => Task.FromResult(new CreatorStats())
    };

    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    var first = service.Open();

    await service.Open();

    Assert.Equal(1, fetchCount);
    Assert.Equal(["Loading"], sink.Log);

    gate.SetResult([DashboardServiceTests.MakeScreenshot("a")]);
    await first;

    Assert.Equal(1, fetchCount);
    Assert.Equal(["Loading", "Loaded:a"], sink.Log);
  }

  [Fact]
  public async Task Open_AfterAClose_FetchesAgain() {
    var fetchCount = 0;

    var api = new FakeApi {
      GetMyScreenshotsImpl = () => {
        fetchCount++;

        return Task.FromResult<IReadOnlyList<DashboardScreenshot>>([]);
      },
      GetCreatorStatsImpl = () => Task.FromResult(new CreatorStats())
    };

    var service = new DashboardService(
      api,
      new FakeModLog(),
      new FakeDashboardPresentationSink()
    );

    await service.Open();
    service.Close();
    await service.Open();

    Assert.Equal(2, fetchCount);
  }

  [Fact]
  public async Task Close_PublishesClosed_AndDropsTheCollection() {
    var api = DashboardServiceTests.CreateApi(["a"], new CreatorStats());
    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    await service.Open();
    service.Close();

    Assert.Equal(["Loading", "Loaded:a", "Closed"], sink.Log);
    Assert.Empty(sink.LastState.Screenshots);
    Assert.Null(sink.LastState.Stats);
  }

  [Fact]
  public async Task Close_WhileLoading_DiscardsTheLateAnswer() {
    var gate = new TaskCompletionSource<IReadOnlyList<DashboardScreenshot>>();

    var api = new FakeApi {
      GetMyScreenshotsImpl = () => gate.Task,
      GetCreatorStatsImpl = () => Task.FromResult(new CreatorStats())
    };

    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    var open = service.Open();

    service.Close();

    gate.SetResult([DashboardServiceTests.MakeScreenshot("a")]);
    await open;

    Assert.Equal(DashboardStatus.Closed, sink.LastState.Status);
    Assert.Empty(sink.LastState.Screenshots);
  }

  [Fact]
  public async Task Close_WhileLoading_ThenOpen_ShowsOnlyTheNewAnswer() {
    var gates = new Queue<TaskCompletionSource<IReadOnlyList<DashboardScreenshot>>>(
      [
        new TaskCompletionSource<IReadOnlyList<DashboardScreenshot>>(),
        new TaskCompletionSource<IReadOnlyList<DashboardScreenshot>>()
      ]
    );
    var pending = new List<TaskCompletionSource<IReadOnlyList<DashboardScreenshot>>>();

    var api = new FakeApi {
      GetMyScreenshotsImpl = () => {
        var gate = gates.Dequeue();

        pending.Add(gate);

        return gate.Task;
      },
      GetCreatorStatsImpl = () => Task.FromResult(new CreatorStats())
    };

    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    var first = service.Open();

    service.Close();

    var second = service.Open();

    pending[1].SetResult([DashboardServiceTests.MakeScreenshot("new")]);
    await second;

    pending[0].SetResult([DashboardServiceTests.MakeScreenshot("old")]);
    await first;

    Assert.Equal(DashboardStatus.Loaded, sink.LastState.Status);
    Assert.Equal("new", Assert.Single(sink.LastState.Screenshots).Id);
  }

  [Fact]
  public async Task Refresh_WhileClosed_DoesNothing() {
    // Any fetch would throw on the unwired fake.
    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(new FakeApi(), new FakeModLog(), sink);

    await service.Refresh();

    Assert.Empty(sink.Log);
  }

  [Fact]
  public async Task OpenDetail_PublishesLoading_ThenTheFullScreenshot() {
    var full = new Screenshot {
      Id = "b",
      Description = "full"
    };

    var requested = new List<string>();

    var api = DashboardServiceTests.CreateApi(
      ["a", "b"],
      new CreatorStats(),
      id => {
        requested.Add(id);

        return Task.FromResult(full);
      }
    );

    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    await service.Open();
    await service.OpenDetail("b");

    Assert.Equal(["b"], requested);
    Assert.Equal(["Loading", "Loaded:a,b", "Detail:Loading:b", "Detail:Loaded:b"], sink.Log);
    Assert.Same(full, sink.LastDetail.Screenshot);
  }

  [Fact]
  public async Task OpenDetail_Failure_PublishesTheError_AndOpeningItAgainRetries() {
    var silent = new List<Exception>();
    var fetchCount = 0;

    var api = DashboardServiceTests.CreateApi(
      ["a"],
      new CreatorStats(),
      id => {
        fetchCount++;

        return fetchCount == 1
          ? Task.FromException<Screenshot>(new HttpNetworkException("1", "offline"))
          : Task.FromResult(
            new Screenshot {
              Id = id
            }
          );
      }
    );

    var log = new FakeModLog {
      ErrorSilentImpl = silent.Add
    };

    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, log, sink);

    await service.Open();

    // Must not throw despite the failed fetch.
    await service.OpenDetail("a");

    Assert.Equal("Detail:Error:a", sink.Log.Last());
    Assert.NotNull(sink.LastDetail.Error);
    Assert.Single(silent);

    await service.OpenDetail("a");

    Assert.Equal("Detail:Loaded:a", sink.Log.Last());
    Assert.Null(sink.LastDetail.Error);

    // The grid's collection stays loaded throughout.
    Assert.Equal(DashboardStatus.Loaded, sink.LastState.Status);
  }

  [Fact]
  public async Task OpenDetail_WithoutACollection_DoesNothing() {
    // Any fetch would throw on the unwired fake.
    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(new FakeApi(), new FakeModLog(), sink);

    await service.OpenDetail("a");

    Assert.Empty(sink.Log);
  }

  [Fact]
  public async Task CloseDetail_WhileLoading_DiscardsTheLateAnswer() {
    var gate = new TaskCompletionSource<Screenshot>();

    var api = DashboardServiceTests.CreateApi(["a"], new CreatorStats(), _ => gate.Task);
    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    await service.Open();

    var detail = service.OpenDetail("a");

    service.CloseDetail();

    gate.SetResult(
      new Screenshot {
        Id = "a"
      }
    );
    await detail;

    Assert.Equal(["Loading", "Loaded:a", "Detail:Loading:a", "Detail:Closed"], sink.Log);
  }

  [Fact]
  public async Task OpenDetail_AnotherWhileLoading_ShowsOnlyTheLatest() {
    var gates = new Dictionary<string, TaskCompletionSource<Screenshot>> {
      ["a"] = new(),
      ["b"] = new()
    };

    var api = DashboardServiceTests.CreateApi(["a", "b"], new CreatorStats(), id => gates[id].Task);
    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    await service.Open();

    var first = service.OpenDetail("a");
    var second = service.OpenDetail("b");

    gates["b"]
      .SetResult(
        new Screenshot {
          Id = "b"
        }
      );
    await second;

    gates["a"]
      .SetResult(
        new Screenshot {
          Id = "a"
        }
      );
    await first;

    Assert.Equal("Detail:Loaded:b", sink.Log.Last());
    Assert.Equal("b", sink.LastDetail.Screenshot?.Id);
  }

  [Fact]
  public async Task Close_ClosesTheDashboardThenItsDetail() {
    var api = DashboardServiceTests.CreateApi(
      ["a"],
      new CreatorStats(),
      id => Task.FromResult(
        new Screenshot {
          Id = id
        }
      )
    );

    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    await service.Open();
    await service.OpenDetail("a");
    service.Close();

    Assert.Equal(["Closed", "Detail:Closed"], sink.Log.Skip(4));
  }

  private static FakeApi CreateApi(
    string[] ids,
    CreatorStats stats,
    Func<string, Task<Screenshot>>? getScreenshot = null
  ) {
    DashboardScreenshot[] screenshots = [.. ids.Select(DashboardServiceTests.MakeScreenshot)];

    return new FakeApi {
      GetMyScreenshotsImpl = () => Task.FromResult<IReadOnlyList<DashboardScreenshot>>(screenshots),
      GetCreatorStatsImpl = () => Task.FromResult(stats),
      GetScreenshotImpl = getScreenshot
    };
  }

  private static DashboardScreenshot MakeScreenshot(string id) =>
    new() {
      Id = id
    };
}
