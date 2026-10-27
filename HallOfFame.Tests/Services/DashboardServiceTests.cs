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
  public async Task OpenOnScreenshot_LoadsTheCollection_ThenOpensTheScreenshot() {
    var api = DashboardServiceTests.CreateApi(
      ["a", "b"],
      new CreatorStats(),
      id => Task.FromResult(
        new Screenshot {
          Id = id
        }
      )
    );

    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    await service.OpenOnScreenshot("b");

    Assert.Equal(["Loading", "Loaded:a,b", "Detail:Loading:b", "Detail:Loaded:b"], sink.Log);
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

  [Fact]
  public async Task ConfirmClose_Confirmed_ClosesTheDashboardThenItsDetail() {
    var held = new Screenshot {
      Id = "a"
    };

    var confirmed = new List<Screenshot>();

    var sink = new FakeDashboardPresentationSink {
      ConfirmDiscardEditsImpl = screenshot => {
        confirmed.Add(screenshot);

        return Task.FromResult(true);
      }
    };

    var service = await DashboardServiceTests.OpenDetailOfA(held, sink);

    await service.ConfirmClose();

    Assert.Same(held, Assert.Single(confirmed));
    Assert.Equal(["Closed", "Detail:Closed"], sink.Log);
  }

  [Fact]
  public async Task ConfirmClose_Declined_KeepsTheDashboardOpen() {
    // The fake sink declines unwired.
    var sink = new FakeDashboardPresentationSink();

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink
    );

    await service.ConfirmClose();

    Assert.Empty(sink.Log);
  }

  [Fact]
  public async Task ConfirmCloseDetail_Confirmed_ReturnsToTheGrid() {
    var sink = new FakeDashboardPresentationSink {
      ConfirmDiscardEditsImpl = _ => Task.FromResult(true)
    };

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink
    );

    await service.ConfirmCloseDetail();

    Assert.Equal(["Detail:Closed"], sink.Log);
  }

  [Fact]
  public async Task ConfirmCloseDetail_Declined_KeepsTheDetail() {
    var sink = new FakeDashboardPresentationSink();

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink
    );

    await service.ConfirmCloseDetail();

    Assert.Empty(sink.Log);
  }

  [Fact]
  public async Task ConfirmClose_DetailClosedUnderTheDialog_ClosesNothingMore() {
    DashboardService? service = null;

    var sink = new FakeDashboardPresentationSink {
      ConfirmDiscardEditsImpl = _ => {
        service?.CloseDetail();

        return Task.FromResult(true);
      }
    };

    service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink
    );

    await service.ConfirmClose();

    Assert.Equal(["Detail:Closed"], sink.Log);
  }

  [Fact]
  public async Task ConfirmClose_OnTheGrid_ClosesWithoutAsking() {
    var sink = new FakeDashboardPresentationSink();

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink
    );

    service.CloseDetail();
    sink.Log.Clear();

    await service.ConfirmClose();

    Assert.Equal(["Closed"], sink.Log);
  }

  [Fact]
  public async Task ConfirmClose_AgainWhileItsDialogIsOpen_AsksOnce() {
    var gate = new TaskCompletionSource<bool>();
    var askCount = 0;

    var sink = new FakeDashboardPresentationSink {
      ConfirmDiscardEditsImpl = _ => {
        askCount++;

        return gate.Task;
      }
    };

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink
    );

    var first = service.ConfirmClose();
    var second = service.ConfirmCloseDetail();

    gate.SetResult(true);
    await Task.WhenAll(first, second);

    Assert.Equal(1, askCount);
    Assert.Equal(["Closed", "Detail:Closed"], sink.Log);
  }

  [Fact]
  public async Task ConfirmClose_WhileTheDeleteDialogIsOpen_AsksNothing() {
    var gate = new TaskCompletionSource<bool>();
    var askedToDiscard = false;

    var sink = new FakeDashboardPresentationSink {
      ConfirmDeleteImpl = _ => gate.Task,
      ConfirmDiscardEditsImpl = _ => {
        askedToDiscard = true;

        return Task.FromResult(true);
      }
    };

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink
    );

    var delete = service.Delete();
    var close = service.ConfirmClose();

    gate.SetResult(false);
    await Task.WhenAll(delete, close);

    Assert.False(askedToDiscard);
    Assert.Empty(sink.Log);
  }

  [Fact]
  public async Task ConfirmClose_WhileSaving_AsksAsAtAnyOtherTime() {
    var gate = new TaskCompletionSource<Screenshot>();
    var askedToDiscard = false;

    var sink = new FakeDashboardPresentationSink {
      ConfirmDiscardEditsImpl = _ => {
        askedToDiscard = true;

        return Task.FromResult(true);
      }
    };

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink,
      (_, _) => gate.Task
    );

    var update = service.Update(
      new ScreenshotUpdate {
        CityName = "New Town"
      }
    );

    sink.Log.Clear();

    await service.ConfirmClose();

    gate.SetResult(
      new Screenshot {
        Id = "a"
      }
    );
    await update;

    Assert.True(askedToDiscard);
    Assert.Equal(["Closed", "Detail:Closed"], sink.Log.Take(2));
  }

  [Fact]
  public async Task ConfirmCloseDetail_AfterTheDetailClosedOnAnUnansweredDialog_AsksAgain() {
    var askCount = 0;

    // A dialog another replaced never answers.
    var sink = new FakeDashboardPresentationSink {
      ConfirmDiscardEditsImpl = _ => {
        askCount++;

        return new TaskCompletionSource<bool>().Task;
      }
    };

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink
    );

    _ = service.ConfirmCloseDetail();

    service.CloseDetail();
    await service.OpenDetail("a");

    _ = service.ConfirmCloseDetail();

    Assert.Equal(2, askCount);
  }

  [Fact]
  public async Task Update_SendsTheEdit_ThenMergesTheAnswer_KeepingWhatItLeavesOut() {
    var creator = new Creator {
      Id = "me"
    };

    var showcasedMod = new HallOfFame.Domain.Mod {
      Id = "12"
    };

    var held = new Screenshot {
      Id = "a",
      CityName = "Old Town",
      CityNameTranslated = "Vieille Ville",
      MapName = "Lakeside",
      ParadoxModIds = [12, 34],
      LikesCount = 7,
      IsLiked = true,
      Creator = creator,
      ShowcasedMod = showcasedMod
    };

    // The answer as the server sends it: no creator, liked state, or showcased mod,
    // the translation of the new name still to come.
    var response = new Screenshot {
      Id = "a",
      CityName = "New Town",
      Description = "Now described",
      ShareParadoxModIds = true,
      ShareRenderSettings = true,
      Rank = "gold"
    };

    var sent = new List<(string Id, ScreenshotUpdate Update)>();

    var update = new ScreenshotUpdate {
      CityName = "New Town",
      Description = "Now described"
    };

    var sink = new FakeDashboardPresentationSink();

    var service = await DashboardServiceTests.OpenDetailOfA(
      held,
      sink,
      (id, sentUpdate) => {
        sent.Add((id, sentUpdate));

        return Task.FromResult(response);
      }
    );

    var other = sink.LastState.Screenshots[1];

    await service.Update(update);

    Assert.Equal([("a", update)], sent);
    Assert.Equal(["Detail:Saving:a", "Loaded:a,b", "Detail:Loaded:a"], sink.Log);

    var merged = sink.LastDetail.Screenshot!;

    Assert.Equal("New Town", merged.CityName);
    Assert.Null(merged.CityNameTranslated);
    Assert.Equal("Now described", merged.Description);
    Assert.True(merged.ShareParadoxModIds);
    Assert.True(merged.ShareRenderSettings);
    Assert.Equal("gold", merged.Rank);
    Assert.Same(creator, merged.Creator);
    Assert.True(merged.IsLiked);
    Assert.Same(showcasedMod, merged.ShowcasedMod);
    Assert.Equal("Lakeside", merged.MapName);
    Assert.Equal([12, 34], merged.ParadoxModIds);
    Assert.Equal(7, merged.LikesCount);

    var item = sink.LastState.Screenshots[0];

    Assert.Equal("New Town", item.CityName);
    Assert.Equal("gold", item.Rank);
    Assert.Same(other, sink.LastState.Screenshots[1]);
  }

  [Fact]
  public async Task Update_NewShowcasedMod_FetchesTheScreenshotAgain() {
    var held = new Screenshot {
      Id = "a"
    };

    // The answer to the update leaves the showcased mod out, the screenshot fetched again has it.
    var refetched = new Screenshot {
      Id = "a",
      ShowcasedMod = new HallOfFame.Domain.Mod {
        ParadoxModId = 34
      }
    };

    var fetches = new Queue<Screenshot>([held, refetched]);

    var api = DashboardServiceTests.CreateApi(
      ["a"],
      new CreatorStats(),
      _ => Task.FromResult(fetches.Dequeue()),
      (_, _) => Task.FromResult(
        new Screenshot {
          Id = "a"
        }
      )
    );

    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    await service.Open();
    await service.OpenDetail("a");

    await service.Update(
      new ScreenshotUpdate {
        ShowcasedModId = "34"
      }
    );

    Assert.Empty(fetches);
    Assert.Same(refetched, sink.LastDetail.Screenshot);
  }

  [Fact]
  public async Task Update_ClearedShowcasedMod_DropsIt() {
    var held = new Screenshot {
      Id = "a",
      ShowcasedMod = new HallOfFame.Domain.Mod {
        Id = "12"
      }
    };

    var sink = new FakeDashboardPresentationSink();

    var service = await DashboardServiceTests.OpenDetailOfA(
      held,
      sink,
      (_, _) => Task.FromResult(
        new Screenshot {
          Id = "a"
        }
      )
    );

    await service.Update(
      new ScreenshotUpdate {
        ShowcasedModId = ""
      }
    );

    Assert.NotNull(sink.LastDetail.Screenshot);
    Assert.Null(sink.LastDetail.Screenshot.ShowcasedMod);
  }

  [Fact]
  public async Task Update_HttpFailure_KeepsTheCollectionAndTheDetail_AndShowsTheError() {
    var silent = new List<Exception>();

    var held = new Screenshot {
      Id = "a",
      CityName = "Old Town"
    };

    var sink = new FakeDashboardPresentationSink();

    var service = await DashboardServiceTests.OpenDetailOfA(
      held,
      sink,
      (_, _) => throw new HttpServerException("42", new HttpQueries.JsonError()),
      log: new FakeModLog {
        ErrorSilentImpl = silent.Add
      }
    );

    var collection = sink.LastState.Screenshots;

    // Must not throw despite the failed save.
    await service.Update(
      new ScreenshotUpdate {
        CityName = "New Town"
      }
    );

    Assert.Equal(["Detail:Saving:a", "Detail:Loaded:a"], sink.Log);
    Assert.Same(held, sink.LastDetail.Screenshot);
    Assert.Same(collection, sink.LastState.Screenshots);
    Assert.Single(silent);
    Assert.Equal(
      $"HallOfFame.Common.ERROR_MESSAGE[{typeof(HttpServerException).FullName}]",
      Assert.Single(sink.Errors).id
    );
  }

  [Fact]
  public async Task Update_UnexpectedFailure_LogsRecoverably_WithoutASecondDialog() {
    var recoverable = new List<Exception>();

    var sink = new FakeDashboardPresentationSink();

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink,
      (_, _) => throw new InvalidOperationException(),
      log: new FakeModLog {
        ErrorRecoverableImpl = recoverable.Add
      }
    );

    await service.Update(
      new ScreenshotUpdate {
        CityName = "New Town"
      }
    );

    Assert.Single(recoverable);
    Assert.Empty(sink.Errors);
    Assert.False(sink.LastDetail.IsSaving);
  }

  [Fact]
  public async Task Update_AgainWhileSaving_SendsOnce() {
    var gate = new TaskCompletionSource<Screenshot>();
    var sendCount = 0;

    var sink = new FakeDashboardPresentationSink();

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink,
      (_, _) => {
        sendCount++;

        return gate.Task;
      }
    );

    var update = new ScreenshotUpdate {
      CityName = "New Town"
    };

    var first = service.Update(update);

    await service.Update(update);

    gate.SetResult(
      new Screenshot {
        Id = "a"
      }
    );
    await first;

    Assert.Equal(1, sendCount);
  }

  [Fact]
  public async Task Update_AnsweredAfterBack_StillMergesIntoTheCollection() {
    var gate = new TaskCompletionSource<Screenshot>();

    var sink = new FakeDashboardPresentationSink();

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink,
      (_, _) => gate.Task
    );

    var update = service.Update(
      new ScreenshotUpdate {
        CityName = "New Town"
      }
    );

    service.CloseDetail();

    gate.SetResult(
      new Screenshot {
        Id = "a",
        CityName = "New Town"
      }
    );
    await update;

    Assert.Equal(["Detail:Saving:a", "Detail:Closed", "Loaded:a,b"], sink.Log);
    Assert.Equal("New Town", sink.LastState.Screenshots[0].CityName);
  }

  [Fact]
  public async Task Delete_Confirmed_DropsTheScreenshot_RefreshesTheStats_AndReturnsToTheGrid() {
    var held = new Screenshot {
      Id = "a",
      CityName = "Old Town"
    };

    var deleted = new List<string>();
    var confirmed = new List<Screenshot>();

    var refreshed = new CreatorStats {
      ScreenshotsCount = 1
    };

    var sink = new FakeDashboardPresentationSink {
      ConfirmDeleteImpl = screenshot => {
        confirmed.Add(screenshot);

        return Task.FromResult(true);
      }
    };

    var service = await DashboardServiceTests.OpenDetailOfA(
      held,
      sink,
      deleteScreenshot: id => {
        deleted.Add(id);

        return Task.CompletedTask;
      },
      stats: new Queue<CreatorStats>([new CreatorStats(), refreshed])
    );

    await service.Delete();

    Assert.Same(held, Assert.Single(confirmed));
    Assert.Equal(["a"], deleted);
    Assert.Equal(["Detail:Deleting:a", "Loaded:b", "Detail:Closed"], sink.Log);
    Assert.Same(refreshed, sink.LastState.Stats);
    Assert.Equal(1, sink.DeletedSoundCount);
  }

  [Fact]
  public async Task Delete_Declined_DoesNothing() {
    // Any delete would throw on the unwired fake, and the fake sink declines unwired.
    var sink = new FakeDashboardPresentationSink();

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink
    );

    await service.Delete();

    Assert.Empty(sink.Log);
    Assert.Equal(0, sink.DeletedSoundCount);
  }

  [Fact]
  public async Task Delete_NotFound_DropsTheScreenshotAllTheSame() {
    var sink = new FakeDashboardPresentationSink {
      ConfirmDeleteImpl = _ => Task.FromResult(true)
    };

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink,
      deleteScreenshot: _ => throw new HttpUserCompatibilityException(
        "42",
        new HttpQueries.JsonError()
      )
    );

    await service.Delete();

    Assert.Equal(["Detail:Deleting:a", "Loaded:b", "Detail:Closed"], sink.Log);
    Assert.Empty(sink.Errors);
  }

  [Fact]
  public async Task Delete_HttpFailure_KeepsTheCollectionAndTheDetail_AndShowsTheError() {
    var silent = new List<Exception>();

    var held = new Screenshot {
      Id = "a"
    };

    var sink = new FakeDashboardPresentationSink {
      ConfirmDeleteImpl = _ => Task.FromResult(true)
    };

    var service = await DashboardServiceTests.OpenDetailOfA(
      held,
      sink,
      deleteScreenshot: _ => throw new HttpServerException("42", new HttpQueries.JsonError()),
      log: new FakeModLog {
        ErrorSilentImpl = silent.Add
      }
    );

    var collection = sink.LastState.Screenshots;

    // Must not throw despite the failed deletion.
    await service.Delete();

    Assert.Equal(["Detail:Deleting:a", "Detail:Loaded:a"], sink.Log);
    Assert.Same(held, sink.LastDetail.Screenshot);
    Assert.Same(collection, sink.LastState.Screenshots);
    Assert.Single(silent);
    Assert.Equal(
      $"HallOfFame.Common.ERROR_MESSAGE[{typeof(HttpServerException).FullName}]",
      Assert.Single(sink.Errors).id
    );
    Assert.Equal(0, sink.DeletedSoundCount);
  }

  [Fact]
  public async Task Delete_StatsRefreshFailure_DropsTheScreenshot_AndKeepsTheStatsHeld() {
    var silent = new List<Exception>();
    var statsCount = 0;

    var sink = new FakeDashboardPresentationSink {
      ConfirmDeleteImpl = _ => Task.FromResult(true)
    };

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink,
      deleteScreenshot: _ => Task.CompletedTask,
      log: new FakeModLog {
        ErrorSilentImpl = silent.Add
      },
      getStats: () => ++statsCount == 1
        ? Task.FromResult(new CreatorStats())
        : throw new HttpNetworkException("1", "offline")
    );

    var stats = sink.LastState.Stats;

    await service.Delete();

    Assert.Equal(["Detail:Deleting:a", "Loaded:b", "Detail:Closed"], sink.Log);
    Assert.Same(stats, sink.LastState.Stats);
    Assert.Single(silent);
    Assert.Empty(sink.Errors);
  }

  [Fact]
  public async Task Delete_AgainWhileDeleting_DeletesOnce() {
    var gate = new TaskCompletionSource<bool>();
    var deleteCount = 0;

    var sink = new FakeDashboardPresentationSink {
      ConfirmDeleteImpl = _ => Task.FromResult(true)
    };

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink,
      deleteScreenshot: _ => {
        deleteCount++;

        return gate.Task;
      }
    );

    var first = service.Delete();

    await service.Delete();

    gate.SetResult(true);
    await first;

    Assert.Equal(1, deleteCount);
  }

  [Fact]
  public async Task Update_WhileDeleting_IsIgnored() {
    var gate = new TaskCompletionSource<bool>();
    var updateCount = 0;

    var sink = new FakeDashboardPresentationSink {
      ConfirmDeleteImpl = _ => Task.FromResult(true)
    };

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink,
      updateScreenshot: (_, _) => {
        updateCount++;

        return Task.FromResult(
          new Screenshot {
            Id = "a"
          }
        );
      },
      deleteScreenshot: _ => gate.Task
    );

    var deletion = service.Delete();

    await service.Update(
      new ScreenshotUpdate {
        CityName = "New Town"
      }
    );

    gate.SetResult(true);
    await deletion;

    Assert.Equal(0, updateCount);
    Assert.DoesNotContain("Detail:Saving:a", sink.Log);
  }

  [Fact]
  public async Task ShowInSlideshow_WhileDeleting_DoesNothing() {
    var gate = new TaskCompletionSource<bool>();

    var sink = new FakeDashboardPresentationSink {
      ConfirmDeleteImpl = _ => Task.FromResult(true)
    };

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink,
      deleteScreenshot: _ => gate.Task
    );

    var deletion = service.Delete();

    service.ShowInSlideshow();

    gate.SetResult(true);
    await deletion;

    Assert.Empty(sink.ShownInSlideshow);
  }

  [Fact]
  public async Task ShowInSlideshow_WhileSaving_DoesNothing() {
    var gate = new TaskCompletionSource<Screenshot>();
    var sink = new FakeDashboardPresentationSink();

    var service = await DashboardServiceTests.OpenDetailOfA(
      new Screenshot {
        Id = "a"
      },
      sink,
      updateScreenshot: (_, _) => gate.Task
    );

    var save = service.Update(
      new ScreenshotUpdate {
        CityName = "New Town"
      }
    );

    service.ShowInSlideshow();

    gate.SetResult(
      new Screenshot {
        Id = "a"
      }
    );
    await save;

    Assert.Empty(sink.ShownInSlideshow);
  }

  [Fact]
  public async Task ShowInSlideshow_HandsTheHeldScreenshotOver_AndClosesThePanel() {
    var held = new Screenshot {
      Id = "a"
    };

    var sink = new FakeDashboardPresentationSink();
    var service = await DashboardServiceTests.OpenDetailOfA(held, sink);

    service.ShowInSlideshow();

    Assert.Same(held, Assert.Single(sink.ShownInSlideshow));
    Assert.Equal(["Closed", "Detail:Closed"], sink.Log);
  }

  [Fact]
  public async Task ShowInSlideshow_WhileTheDetailLoads_DoesNothing() {
    var api = DashboardServiceTests.CreateApi(
      ["a"],
      new CreatorStats(),
      _ => new TaskCompletionSource<Screenshot>().Task
    );

    var sink = new FakeDashboardPresentationSink();
    var service = new DashboardService(api, new FakeModLog(), sink);

    await service.Open();

    _ = service.OpenDetail("a");

    service.ShowInSlideshow();

    Assert.Empty(sink.ShownInSlideshow);
    Assert.Equal(DashboardStatus.Loaded, sink.LastState.Status);
  }

  private static FakeApi CreateApi(
    string[] ids,
    CreatorStats stats,
    Func<string, Task<Screenshot>>? getScreenshot = null,
    Func<string, ScreenshotUpdate, Task<Screenshot>>? updateScreenshot = null
  ) {
    DashboardScreenshot[] screenshots = [.. ids.Select(DashboardServiceTests.MakeScreenshot)];

    return new FakeApi {
      GetMyScreenshotsImpl = () => Task.FromResult<IReadOnlyList<DashboardScreenshot>>(screenshots),
      GetCreatorStatsImpl = () => Task.FromResult(stats),
      GetScreenshotImpl = getScreenshot,
      UpdateScreenshotImpl = updateScreenshot
    };
  }

  /// <summary>
  /// A service showing the detail of "a", held in full, in a collection of "a" and "b",
  /// the mutations wired as given and the stats answered in turn from the queue, the first on open.
  /// </summary>
  private static async Task<DashboardService> OpenDetailOfA(
    Screenshot held,
    FakeDashboardPresentationSink sink,
    Func<string, ScreenshotUpdate, Task<Screenshot>>? updateScreenshot = null,
    FakeModLog? log = null,
    Func<string, Task>? deleteScreenshot = null,
    Queue<CreatorStats>? stats = null,
    Func<Task<CreatorStats>>? getStats = null
  ) {
    var api = new FakeApi {
      GetMyScreenshotsImpl = () => Task.FromResult<IReadOnlyList<DashboardScreenshot>>(
        [DashboardServiceTests.MakeScreenshot("a"), DashboardServiceTests.MakeScreenshot("b")]
      ),
      GetCreatorStatsImpl =
        getStats ?? (() => Task.FromResult(stats?.Dequeue() ?? new CreatorStats())),
      GetScreenshotImpl = _ => Task.FromResult(held),
      UpdateScreenshotImpl = updateScreenshot,
      DeleteScreenshotImpl = deleteScreenshot
    };

    var service = new DashboardService(api, log ?? new FakeModLog(), sink);

    await service.Open();
    await service.OpenDetail("a");

    sink.Log.Clear();

    return service;
  }

  private static DashboardScreenshot MakeScreenshot(string id) =>
    new() {
      Id = id
    };
}
