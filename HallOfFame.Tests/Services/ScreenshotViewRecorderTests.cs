using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using HallOfFame.Tests.Logging;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class ScreenshotViewRecorderTests {
  [Fact]
  public async Task RecordView_PostsTheGivenScreenshotId() {
    var viewedIds = new List<string>();

    var api = new FakeApi {
      MarkScreenshotViewedImpl = id => {
        viewedIds.Add(id);

        return Task.FromResult(new View());
      }
    };

    var recorder = new ScreenshotViewRecorder(api, new FakeModLog());

    await recorder.RecordView("s0");

    Assert.Equal("s0", Assert.Single(viewedIds));
  }

  /// <summary>
  /// The contract the fire-and-forget call site relies on: a failed recording is swallowed (the
  /// task never faults) and logged silently, never surfaced to the user.
  /// </summary>
  [Fact]
  public async Task RecordView_OnError_IsSwallowed_AndLoggedSilently() {
    var api = new FakeApi {
      MarkScreenshotViewedImpl = _ =>
        Task.FromException<View>(new InvalidOperationException("boom"))
    };

    var logged = new List<Exception>();

    var recorder =
      new ScreenshotViewRecorder(api, new FakeModLog { ErrorSilentImpl = logged.Add });

    // Must not throw, even though the API faulted.
    await recorder.RecordView("s0");

    Assert.IsType<InvalidOperationException>(Assert.Single(logged));
  }

  [Fact]
  public async Task RecordView_CountsEachScreenshotAtMostOncePerSession() {
    var viewedIds = new List<string>();

    var api = new FakeApi {
      MarkScreenshotViewedImpl = id => {
        viewedIds.Add(id);

        return Task.FromResult(new View());
      }
    };

    var recorder = new ScreenshotViewRecorder(api, new FakeModLog());

    // The weighted-random feed can serve the same screenshot again later in the session; only the
    // first sighting of each id is counted.
    await recorder.RecordView("s0");
    await recorder.RecordView("s1");
    await recorder.RecordView("s0");

    Assert.Equal(["s0", "s1"], viewedIds);
  }

  /// <summary>
  /// A failed recording was never counted server-side, so the id is not held back: a later
  /// reappearance of the screenshot gets another chance to record it.
  /// </summary>
  [Fact]
  public async Task RecordView_AfterAFailedRecording_RetriesOnReappearance() {
    var attempts = new List<string>();
    var failNext = true;

    var api = new FakeApi {
      MarkScreenshotViewedImpl = id => {
        attempts.Add(id);

        if (failNext) {
          failNext = false;

          return Task.FromException<View>(new InvalidOperationException("boom"));
        }

        return Task.FromResult(new View());
      }
    };

    var recorder = new ScreenshotViewRecorder(api, new FakeModLog());

    // First attempt fails (swallowed), so the id is not retained; the second one is attempted and
    // succeeds; a third is then deduped.
    await recorder.RecordView("s0");
    await recorder.RecordView("s0");
    await recorder.RecordView("s0");

    Assert.Equal(["s0", "s0"], attempts);
  }
}
