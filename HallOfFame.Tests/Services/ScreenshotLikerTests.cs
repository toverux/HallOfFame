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

public sealed class ScreenshotLikerTests {
  [Fact]
  public async Task Toggle_WithNoCurrentScreenshot_IsANoOp() {
    // A carousel that was never advanced has no current screenshot; the like API would throw if it
    // were ever called.
    var carousel = new ScreenshotCarousel(new FakeApi(), new FakePreloader(), () => "4k");

    var rendered = new List<Screenshot>();
    var liker = ScreenshotLikerTests.MakeLiker(carousel, new FakeApi(), rendered);

    await liker.Toggle();

    Assert.Null(carousel.Current);
    Assert.Empty(rendered);
  }

  [Fact]
  public async Task Toggle_Like_SendsLikedTrue_AndKeepsTheOptimisticUpdate() {
    var likeCalls = new List<(string Id, bool Liked)>();

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () =>
        Task.FromResult(ScreenshotLikerTests.MakeScreenshot("s0", likesCount: 10)),
      LikeScreenshotImpl = (id, liked) => {
        likeCalls.Add((id, liked));

        return Task.FromResult(new View());
      }
    };

    var carousel = await ScreenshotLikerTests.SeededCarousel(api);

    var rendered = new List<Screenshot>();
    var liker = ScreenshotLikerTests.MakeLiker(carousel, api, rendered);

    await liker.Toggle();

    Assert.Equal(("s0", true), Assert.Single(likeCalls));
    Assert.True(carousel.Current!.IsLiked);
    Assert.Equal(11, carousel.Current!.LikesCount);
    Assert.True(Assert.Single(rendered).IsLiked);
  }

  /// <summary>
  /// The crown jewel: a second toggle made while the first like request is still in flight is not
  /// dropped. The displayed state flips immediately, and the single sync loop, once the in-flight
  /// request resolves, issues exactly one follow-up request to converge the server onto what the
  /// user now sees.
  /// </summary>
  [Fact]
  public async Task Toggle_RapidToggleWhileInFlight_CoalescesIntoSerializedRequests() {
    var likeCalls = new List<(string Id, bool Liked)>();
    var gates = new List<TaskCompletionSource<View>>();

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () =>
        Task.FromResult(ScreenshotLikerTests.MakeScreenshot("s0", likesCount: 10)),
      LikeScreenshotImpl = (id, liked) => {
        likeCalls.Add((id, liked));

        var gate = new TaskCompletionSource<View>();
        gates.Add(gate);

        return gate.Task;
      }
    };

    var carousel = await ScreenshotLikerTests.SeededCarousel(api);

    var liker = ScreenshotLikerTests.MakeLiker(carousel, api);

    // First toggle (like): issues request #1 (s0, true) and suspends on its gate.
    var syncTask = liker.Toggle();

    Assert.Equal(("s0", true), Assert.Single(likeCalls));
    Assert.True(carousel.Current!.IsLiked);

    // Second toggle (unlike) while request #1 is still in flight: flips the UI back but issues no
    // request yet, as the running loop owns the single in-flight request.
    await liker.Toggle();

    Assert.Single(gates);
    Assert.False(carousel.Current!.IsLiked);

    // Release request #1: the loop observes the unliked state and issues request #2 (s0, false).
    gates[0].SetResult(new View());

    await ScreenshotLikerTests.WaitUntil(() => gates.Count == 2);

    Assert.Equal(("s0", false), likeCalls[1]);

    // Release request #2: the displayed state now matches what was sent, so the loop stops.
    gates[1].SetResult(new View());

    await syncTask;

    Assert.Equal(2, likeCalls.Count);
    Assert.False(carousel.Current!.IsLiked);
    Assert.Equal(10, carousel.Current!.LikesCount);
  }

  [Fact]
  public async Task Toggle_RequestFails_ReportsFailure_AndRevertsToServerTruth() {
    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () =>
        Task.FromResult(ScreenshotLikerTests.MakeScreenshot("s0", likesCount: 10)),
      LikeScreenshotImpl = (_, _) =>
        Task.FromException<View>(new HttpNetworkException("1", "boom"))
    };

    var carousel = await ScreenshotLikerTests.SeededCarousel(api);

    var rendered = new List<Screenshot>();
    var failures = new List<HttpException>();
    var liker = ScreenshotLikerTests.MakeLiker(carousel, api, rendered, failures);

    await liker.Toggle();

    Assert.IsType<HttpNetworkException>(Assert.Single(failures));

    // The optimistic like was reverted: the cursor is back on the unliked, count-10 server truth.
    Assert.False(carousel.Current!.IsLiked);
    Assert.Equal(10, carousel.Current!.LikesCount);

    // The UI saw the optimistic like, then the revert.
    Assert.Equal(2, rendered.Count);
    Assert.True(rendered[0].IsLiked);
    Assert.False(rendered[1].IsLiked);
  }

  [Fact]
  public async Task Toggle_NonHttpError_IsLogged_AndKeepsTheOptimisticUpdate() {
    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () =>
        Task.FromResult(ScreenshotLikerTests.MakeScreenshot("s0", likesCount: 10)),
      LikeScreenshotImpl = (_, _) =>
        Task.FromException<View>(new InvalidOperationException("boom"))
    };

    var carousel = await ScreenshotLikerTests.SeededCarousel(api);

    var logged = new List<Exception>();
    var failures = new List<HttpException>();

    var liker = new ScreenshotLiker(
      carousel,
      api,
      new FakeModLog { ErrorRecoverableImpl = logged.Add },
      _ => { },
      failures.Add
    );

    await liker.Toggle();

    // A non-HTTP error is logged as recoverable, not surfaced as a user-facing failure...
    Assert.IsType<InvalidOperationException>(Assert.Single(logged));
    Assert.Empty(failures);

    // ...and the optimistic update is left in place (only an HTTP failure carries the known server
    // truth needed to revert).
    Assert.True(carousel.Current!.IsLiked);
    Assert.Equal(11, carousel.Current!.LikesCount);
  }

  /// <summary>
  /// A request that fails after the user has navigated to another screenshot must not write the
  /// stale screenshot over the new one. The revert is skipped when the cursor has moved.
  /// </summary>
  [Fact]
  public async Task Toggle_FailsAfterNavigatedAway_DoesNotRevertOntoNewScreenshot() {
    var screenshots = new Queue<Screenshot>(
      [
        ScreenshotLikerTests.MakeScreenshot("s0", likesCount: 10),
        ScreenshotLikerTests.MakeScreenshot("s1", likesCount: 20)
      ]
    );

    var gate = new TaskCompletionSource<View>();

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () => Task.FromResult(screenshots.Dequeue()),
      LikeScreenshotImpl = (_, _) => gate.Task
    };

    var carousel = await ScreenshotLikerTests.SeededCarousel(api);

    var rendered = new List<Screenshot>();
    var failures = new List<HttpException>();
    var liker = ScreenshotLikerTests.MakeLiker(carousel, api, rendered, failures);

    // Like s0; its request is in flight.
    var syncTask = liker.Toggle();

    // Navigate to s1 before the request resolves.
    await carousel.Next();

    Assert.Equal("s1", carousel.Current!.Id);

    // The request now fails: the failure is reported, but no revert is written onto s1.
    gate.SetException(new HttpNetworkException("1", "boom"));

    await syncTask;

    Assert.IsType<HttpNetworkException>(Assert.Single(failures));
    Assert.Equal("s1", carousel.Current!.Id);
    Assert.Equal(20, carousel.Current!.LikesCount);

    // Only the optimistic like on s0 was rendered; no revert render happened after navigation.
    Assert.True(Assert.Single(rendered).IsLiked);
  }

  private static ScreenshotLiker MakeLiker(
    ScreenshotCarousel carousel,
    IHallOfFameApi api,
    List<Screenshot>? rendered = null,
    List<HttpException>? failures = null
  ) =>
    new(
      carousel,
      api,
      new FakeModLog(),
      screenshot => rendered?.Add(screenshot),
      ex => failures?.Add(ex)
    );

  /// <summary>
  /// Builds a carousel over the given API and advances it once, so <c>Current</c> is the first
  /// screenshot the API's weighted-random endpoint returns.
  /// </summary>
  private static async Task<ScreenshotCarousel> SeededCarousel(FakeApi api) {
    var carousel = new ScreenshotCarousel(api, new FakePreloader(), () => "4k");

    await carousel.Next();

    return carousel;
  }

  private static Screenshot MakeScreenshot(string id, bool isLiked = false, int likesCount = 0) =>
    new() {
      Id = id,
      IsLiked = isLiked,
      LikesCount = likesCount,
      ImageUrlFHD = $"https://img/{id}-fhd.jpg",
      ImageUrl4K = $"https://img/{id}-4k.jpg"
    };

  /// <summary>
  /// Pumps the test's async continuations until <paramref name="condition"/> holds, so a loop step
  /// that runs on a resumed continuation (after a gated request completes) is observed without
  /// depending on whether continuations run inline or are posted to the test sync-context.
  /// </summary>
  private static async Task WaitUntil(Func<bool> condition) {
    for (var i = 0; i < 1000 && !condition(); i++) {
      await Task.Yield();
    }

    Assert.True(condition(), "Condition was not met in time.");
  }
}
