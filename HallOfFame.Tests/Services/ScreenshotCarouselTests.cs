using System;
using System.Linq;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class ScreenshotCarouselTests {
  [Fact]
  public async Task Next_OnEmpty_FetchesAndSetsCurrent() {
    var carousel = new ScreenshotCarousel(ScreenshotCarouselTests.SequentialApi(out _, "s0"));

    var step = await carousel.Next();

    // Landing on the freshly fetched screenshot is at the front of the window, so it preloads
    // ahead.
    Assert.Equal("s0", step.Current.Id);
    Assert.True(step.ShouldPreloadAhead);

    Assert.Equal("s0", carousel.Current?.Id);
    Assert.Equal(0, carousel.CurrentIndex);
    Assert.Equal(1, carousel.Count);
    Assert.False(carousel.HasPrevious);
    Assert.True(carousel.IsAtEnd);
  }

  [Fact]
  public async Task Next_ApiError_Propagates_AndLeavesCurrentUnchanged() {
    var calls = 0;

    var api = new FakeApi {
      GetRandomScreenshotWeightedImpl = () => {
        calls++;

        return calls == 1
          ? Task.FromResult(ScreenshotCarouselTests.MakeScreenshot("s0"))
          : throw new HttpNetworkException("1", "boom");
      }
    };

    var carousel = new ScreenshotCarousel(api);

    await carousel.Next();

    await Assert.ThrowsAsync<HttpNetworkException>(carousel.Next);

    Assert.Equal("s0", carousel.Current?.Id);
    Assert.Equal(1, carousel.Count);
  }

  [Fact]
  public async Task Next_WithLookAhead_AdvancesWithoutFetching() {
    var api = ScreenshotCarouselTests.SequentialApi(out var callCount, "s0", "s1");

    var carousel = new ScreenshotCarousel(api);

    await carousel.Next();
    await carousel.PreloadAhead();

    var callsBeforeAdvance = callCount();

    var step = await carousel.Next();

    Assert.Equal(callsBeforeAdvance, callCount());

    // The cursor moved onto the prefetched look-ahead, which is now the window's front, so it
    // preloads ahead.
    Assert.Equal("s1", step.Current.Id);
    Assert.True(step.ShouldPreloadAhead);

    Assert.True(carousel.HasPrevious);
  }

  [Fact]
  public async Task Previous_AtFirstScreenshot_Throws() {
    var carousel = new ScreenshotCarousel(ScreenshotCarouselTests.SequentialApi(out _, "s0"));

    await carousel.Next();

    Assert.Throws<InvalidOperationException>(() => carousel.Previous());
  }

  [Fact]
  public async Task Previous_MovesBack_WithoutFetching() {
    var api = ScreenshotCarouselTests.SequentialApi(out var callCount, "s0", "s1");

    var carousel = new ScreenshotCarousel(api);

    await carousel.Next();
    await carousel.PreloadAhead();
    await carousel.Next();

    var callsBeforePrevious = callCount();

    var step = carousel.Previous();

    Assert.Equal(callsBeforePrevious, callCount());

    // Scrolling back lands on an already-seen screenshot with look-ahead still ahead of it: the
    // degenerate step does not preload ahead.
    Assert.Equal("s0", step.Current.Id);
    Assert.False(step.ShouldPreloadAhead);

    Assert.False(carousel.HasPrevious);
  }

  /// <summary>
  /// Forward through scrollback: after stepping back into the window, moving forward again lands on
  /// an already-seen middle screenshot (<see cref="ScreenshotCarousel.IsAtEnd"/> is false), so the
  /// step must not preload ahead.
  /// </summary>
  [Fact]
  public async Task Next_AfterScrollback_OntoMiddle_DoesNotPreloadAhead() {
    var carousel = new ScreenshotCarousel(ScreenshotCarouselTests.CountingApi());

    // Walk forward far enough to build scrollback (the system prefetches a look-ahead after each
    // forward step), then step back twice to land in the middle of the window.
    await ScreenshotCarouselTests.Drive(
      carousel,
      Move.Next,
      Move.Next,
      Move.Next,
      Move.Previous,
      Move.Previous
    );

    var step = await carousel.Next();

    Assert.Equal("s1", step.Current.Id);
    Assert.False(step.ShouldPreloadAhead);
    Assert.False(carousel.IsAtEnd);
  }

  [Fact]
  public async Task PreloadAhead_AppendsLookAhead_WithoutMovingCursor() {
    var api = ScreenshotCarouselTests.SequentialApi(out _, "s0", "s1");

    var carousel = new ScreenshotCarousel(api);

    await carousel.Next();

    var currentBeforePreload = carousel.Current;

    await carousel.PreloadAhead();

    Assert.Equal(2, carousel.Count);
    Assert.Equal(0, carousel.CurrentIndex);
    Assert.Same(currentBeforePreload, carousel.Current);
  }

  /// <summary>
  /// The dedupe loop refetches while the weighted-random endpoint keeps returning the screenshot
  /// already displayed and stops as soon as a different one arrives.
  /// </summary>
  [Fact]
  public async Task PreloadAhead_RefetchesUntilDifferentFromCurrent() {
    // First fetch (for the displayed screenshot) is "s0"; the look-ahead then returns "s0" twice
    // more before finally returning a distinct "s1".
    var api = ScreenshotCarouselTests.SequentialApi(
      out var callCount,
      "s0",
      "s0",
      "s0",
      "s1"
    );

    var carousel = new ScreenshotCarousel(api);

    await carousel.Next();
    await carousel.PreloadAhead();

    Assert.Equal(4, callCount());
    Assert.Equal(2, carousel.Count);

    var step = await carousel.Next();

    Assert.Equal("s1", step.Current.Id);
  }

  /// <summary>
  /// Once the window grows past its cap, the oldest screenshot is trimmed off the front, and the
  /// cursor is adjusted so it keeps pointing at the same screenshot.
  /// </summary>
  [Fact]
  public async Task PreloadAhead_TrimsWindowAndKeepsCursorOnSameScreenshot() {
    // A counting endpoint that returns "s0", "s1", "s2"... so every fetch is distinct (the dedupe
    // loop never spins).
    var carousel = new ScreenshotCarousel(ScreenshotCarouselTests.CountingApi());

    // Drive the slideshow exactly as the system does: advance, then prefetch when the step says so.
    await ScreenshotCarouselTests.Drive(
      carousel,
      Enumerable.Repeat(Move.Next, 25).ToArray()
    );

    // The window is capped, and the cursor still points at the last screenshot advanced onto (the
    // 25th, "s24"), proving the trim adjusted the index rather than corrupting it.
    Assert.Equal(20, carousel.Count);
    Assert.Equal("s24", carousel.Current?.Id);
    Assert.True(carousel.CurrentIndex >= 0 && carousel.CurrentIndex < carousel.Count);
  }

  [Fact]
  public async Task ReplaceCurrent_SwapsInPlace_WithoutMovingCursor() {
    var carousel = new ScreenshotCarousel(ScreenshotCarouselTests.SequentialApi(out _, "s0"));

    await carousel.Next();

    var liked = carousel.Current! with { LikesCount = 99 };

    carousel.ReplaceCurrent(liked);

    Assert.Same(liked, carousel.Current);
    Assert.Equal(1, carousel.Count);
    Assert.Equal(0, carousel.CurrentIndex);
  }

  [Fact]
  public void ReplaceCurrent_WithNoCurrent_Throws() {
    var carousel = new ScreenshotCarousel(ScreenshotCarouselTests.SequentialApi(out _, "s0"));

    Assert.Throws<InvalidOperationException>(() =>
      carousel.ReplaceCurrent(ScreenshotCarouselTests.MakeScreenshot("x"))
    );
  }

  #if DEBUG
  [Fact]
  public async Task LoadById_FetchesAppendsAndAdvances() {
    var api = new FakeApi {
      GetScreenshotImpl = id => Task.FromResult(ScreenshotCarouselTests.MakeScreenshot(id))
    };

    var carousel = new ScreenshotCarousel(api);

    var step = await carousel.LoadById("abc");

    // Loading by ID lands at the front of the window, so its step behaves like any other forward
    // move: it preloads ahead.
    Assert.Equal("abc", step.Current.Id);
    Assert.True(step.ShouldPreloadAhead);

    Assert.Equal("abc", carousel.Current?.Id);
    Assert.Equal(0, carousel.CurrentIndex);
    Assert.Equal(1, carousel.Count);
  }
  #endif

  private static Screenshot MakeScreenshot(string id) =>
    new() {
      Id = id,
      ImageUrlFHD = $"https://img/{id}-fhd.jpg",
      ImageUrl4K = $"https://img/{id}-4k.jpg"
    };

  /// <summary>
  /// Drives the carousel the way <c>SlideshowUISystem</c> does: each move applies its returned
  /// <see cref="NavigationStep"/>, and a step that asks to preload ahead triggers the look-ahead
  /// prefetch (the system fires it in the background; here it is awaited so the window settles).
  /// </summary>
  private static async Task Drive(ScreenshotCarousel carousel, params Move[] moves) {
    foreach (var move in moves) {
      var step = move switch {
        Move.Next => await carousel.Next(),
        Move.Previous => carousel.Previous(),
        _ => throw new ArgumentOutOfRangeException(nameof(moves), move, null)
      };

      if (step.ShouldPreloadAhead) {
        await carousel.PreloadAhead();
      }
    }
  }

  /// <summary>
  /// A fake API whose weighted-random endpoint returns the given IDs in order;
  /// <paramref name="callCount"/> exposes how many times it has been invoked.
  /// </summary>
  private static FakeApi SequentialApi(out Func<int> callCount, params string[] ids) {
    var index = 0;

    callCount = () => index;

    return new FakeApi {
      GetRandomScreenshotWeightedImpl = () =>
        Task.FromResult(ScreenshotCarouselTests.MakeScreenshot(ids[index++]))
    };
  }

  /// <summary>
  /// A fake API whose weighted-random endpoint returns an unbounded stream of distinct screenshots
  /// "s0", "s1", "s2"...
  /// </summary>
  private static FakeApi CountingApi() {
    var count = 0;

    return new FakeApi {
      GetRandomScreenshotWeightedImpl = () =>
        Task.FromResult(ScreenshotCarouselTests.MakeScreenshot($"s{count++}"))
    };
  }

  /// <summary>
  /// A single slideshow move fed to <see cref="Drive"/>.
  /// </summary>
  private enum Move { Next, Previous }
}
