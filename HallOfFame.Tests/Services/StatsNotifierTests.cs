using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using HallOfFame.Tests.Logging;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class StatsNotifierTests {
  [Fact]
  public async Task ShowIfNotable_Emits_WhenLikesMeetThreshold() {
    var stats = new CreatorStats { LikesCount = 2 };
    var shown = new List<CreatorStats>();

    var api = new FakeApi { GetCreatorStatsImpl = () => Task.FromResult(stats) };

    var notifier = new StatsNotifier(api, new FakeModLog(), shown.Add);

    await notifier.ShowIfNotable();

    Assert.Same(stats, Assert.Single(shown));
  }

  [Fact]
  public async Task ShowIfNotable_DoesNotEmit_WhenLikesBelowThreshold() {
    var shown = new List<CreatorStats>();

    var api = new FakeApi {
      GetCreatorStatsImpl = () => Task.FromResult(new CreatorStats { LikesCount = 1 })
    };

    var notifier = new StatsNotifier(api, new FakeModLog(), shown.Add);

    await notifier.ShowIfNotable();

    Assert.Empty(shown);
  }

  [Fact]
  public async Task ShowIfNotable_IsNoOp_WhileAFetchIsInFlight() {
    var stats = new CreatorStats { LikesCount = 2 };
    var shown = new List<CreatorStats>();
    var fetchCount = 0;
    var gate = new TaskCompletionSource<CreatorStats>();

    var api = new FakeApi {
      GetCreatorStatsImpl = () => {
        fetchCount++;

        return gate.Task;
      }
    };

    var notifier = new StatsNotifier(api, new FakeModLog(), shown.Add);

    // The first call starts the fetch and parks on the gate.
    var first = notifier.ShowIfNotable();

    // A second call while the first is still loading must be a no-op: no second fetch.
    await notifier.ShowIfNotable();

    Assert.Equal(1, fetchCount);
    Assert.Empty(shown);

    // Release the gate and let the first call run to completion.
    gate.SetResult(stats);
    await first;

    Assert.Equal(1, fetchCount);
    Assert.Same(stats, Assert.Single(shown));
  }

  [Fact]
  public async Task ShowIfNotable_DoesNotReEmit_AfterANotableShow() {
    var stats = new CreatorStats { LikesCount = 2 };
    var shown = new List<CreatorStats>();
    var fetchCount = 0;

    var api = new FakeApi {
      GetCreatorStatsImpl = () => {
        fetchCount++;

        return Task.FromResult(stats);
      }
    };

    var notifier = new StatsNotifier(api, new FakeModLog(), shown.Add);

    await notifier.ShowIfNotable();
    await notifier.ShowIfNotable();

    Assert.Equal(1, fetchCount);
    Assert.Single(shown);
  }

  [Fact]
  public async Task ShowIfNotable_ReFetchesAndEmits_AfterABelowThresholdResult() {
    var notable = new CreatorStats { LikesCount = 2 };
    var shown = new List<CreatorStats>();
    var fetchCount = 0;

    var api = new FakeApi {
      GetCreatorStatsImpl = () => {
        fetchCount++;

        // Below threshold on the first fetch, notable on the second.
        return Task.FromResult(fetchCount == 1 ? new CreatorStats { LikesCount = 1 } : notable);
      }
    };

    var notifier = new StatsNotifier(api, new FakeModLog(), shown.Add);

    await notifier.ShowIfNotable();
    Assert.Empty(shown);

    await notifier.ShowIfNotable();

    Assert.Equal(2, fetchCount);
    Assert.Same(notable, Assert.Single(shown));
  }

  [Fact]
  public async Task ShowIfNotable_LogsSilentlyAndStaysRetryable_OnHttpException() {
    var notable = new CreatorStats { LikesCount = 2 };
    var shown = new List<CreatorStats>();
    var silent = new List<Exception>();
    var recoverable = new List<Exception>();
    var fetchCount = 0;

    var api = new FakeApi {
      GetCreatorStatsImpl = () => {
        fetchCount++;

        return fetchCount == 1
          ? throw new HttpServerException("42", new HttpQueries.JsonError())
          : Task.FromResult(notable);
      }
    };

    var log = new FakeModLog {
      ErrorSilentImpl = silent.Add, ErrorRecoverableImpl = recoverable.Add
    };

    var notifier = new StatsNotifier(api, log, shown.Add);

    // Must not throw despite the failed fetch.
    await notifier.ShowIfNotable();

    Assert.Single(silent);
    Assert.Empty(recoverable);
    Assert.Empty(shown);

    // The failure is retryable: a later call re-fetches and can emit.
    await notifier.ShowIfNotable();

    Assert.Equal(2, fetchCount);
    Assert.Same(notable, Assert.Single(shown));
  }

  [Fact]
  public async Task ShowIfNotable_LogsRecoverablyAndStaysRetryable_OnOtherException() {
    var notable = new CreatorStats { LikesCount = 2 };
    var shown = new List<CreatorStats>();
    var silent = new List<Exception>();
    var recoverable = new List<Exception>();
    var fetchCount = 0;

    var api = new FakeApi {
      GetCreatorStatsImpl = () => {
        fetchCount++;

        return fetchCount == 1
          ? throw new InvalidOperationException("boom")
          : Task.FromResult(notable);
      }
    };

    var log = new FakeModLog {
      ErrorSilentImpl = silent.Add, ErrorRecoverableImpl = recoverable.Add
    };

    var notifier = new StatsNotifier(api, log, shown.Add);

    // Must not throw despite the failed fetch.
    await notifier.ShowIfNotable();

    Assert.Single(recoverable);
    Assert.Empty(silent);
    Assert.Empty(shown);

    // The failure is retryable: a later call re-fetches and can emit.
    await notifier.ShowIfNotable();

    Assert.Equal(2, fetchCount);
    Assert.Same(notable, Assert.Single(shown));
  }
}
