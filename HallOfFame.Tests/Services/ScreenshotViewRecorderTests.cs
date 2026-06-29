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
}
