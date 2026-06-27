using System;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class ScreenshotCarouselTests {
  [Fact]
  public async Task Next_OnEmpty_FetchesPreloadsAndSetsCurrent() {
    var carousel = new ScreenshotCarousel(
      ScreenshotCarouselTests.SequentialApi(out _, "s0"),
      new FakePreloader(),
      () => "4k"
    );

    await carousel.Next();

    Assert.Equal("s0", carousel.Current?.Id);
    Assert.Equal(0, carousel.CurrentIndex);
    Assert.Equal(1, carousel.Count);
    Assert.False(carousel.HasPrevious);
    Assert.True(carousel.IsAtEnd);
  }

  [Theory]
  [InlineData("4k", "https://img/s0-4k.jpg")]
  [InlineData("fhd", "https://img/s0-fhd.jpg")]
  public async Task Next_PreloadsUrlForConfiguredResolution(string resolution, string expectedUrl) {
    string? preloadedUrl = null;

    var preloader = new FakePreloader {
      PreloadImpl = url => {
        preloadedUrl = url;

        return Task.CompletedTask;
      }
    };

    var carousel = new ScreenshotCarousel(
      ScreenshotCarouselTests.SequentialApi(out _, "s0"),
      preloader,
      () => resolution
    );

    await carousel.Next();

    Assert.Equal(expectedUrl, preloadedUrl);
  }

  [Fact]
  public async Task Next_UnknownResolution_Throws_AndLeavesWindowEmpty() {
    var carousel = new ScreenshotCarousel(
      ScreenshotCarouselTests.SequentialApi(out _, "s0"),
      new FakePreloader(),
      () => "8k"
    );

    await Assert.ThrowsAsync<InvalidOperationException>(carousel.Next);

    Assert.Null(carousel.Current);
    Assert.Equal(0, carousel.Count);
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

    var carousel = new ScreenshotCarousel(api, new FakePreloader(), () => "4k");

    await carousel.Next();

    await Assert.ThrowsAsync<HttpNetworkException>(carousel.Next);

    Assert.Equal("s0", carousel.Current?.Id);
    Assert.Equal(1, carousel.Count);
  }

  [Fact]
  public async Task Next_PreloadError_Propagates_AndLeavesWindowEmpty() {
    var preloader = new FakePreloader {
      PreloadImpl = url => throw new ImagePreloadFailedException(url)
    };

    var carousel = new ScreenshotCarousel(
      ScreenshotCarouselTests.SequentialApi(out _, "s0"),
      preloader,
      () => "4k"
    );

    await Assert.ThrowsAsync<ImagePreloadFailedException>(carousel.Next);

    Assert.Null(carousel.Current);
    Assert.Equal(0, carousel.Count);
  }

  [Fact]
  public async Task Next_WithLookAhead_AdvancesWithoutFetching() {
    var api = ScreenshotCarouselTests.SequentialApi(out var callCount, "s0", "s1");

    var carousel = new ScreenshotCarousel(api, new FakePreloader(), () => "4k");

    await carousel.Next();
    await carousel.PreloadAhead();

    var callsBeforeAdvance = callCount();

    await carousel.Next();

    Assert.Equal(callsBeforeAdvance, callCount());
    Assert.Equal("s1", carousel.Current?.Id);
    Assert.True(carousel.HasPrevious);
  }

  [Fact]
  public async Task Previous_AtFirstScreenshot_Throws() {
    var carousel = new ScreenshotCarousel(
      ScreenshotCarouselTests.SequentialApi(out _, "s0"),
      new FakePreloader(),
      () => "4k"
    );

    await carousel.Next();

    await Assert.ThrowsAsync<InvalidOperationException>(carousel.Previous);
  }

  [Fact]
  public async Task Previous_MovesBackAndRePreloads_WithoutFetching() {
    string? preloadedUrl = null;

    var preloader = new FakePreloader {
      PreloadImpl = url => {
        preloadedUrl = url;

        return Task.CompletedTask;
      }
    };

    var api = ScreenshotCarouselTests.SequentialApi(out var callCount, "s0", "s1");

    var carousel = new ScreenshotCarousel(api, preloader, () => "4k");

    await carousel.Next();
    await carousel.PreloadAhead();
    await carousel.Next();

    var callsBeforePrevious = callCount();

    await carousel.Previous();

    Assert.Equal(callsBeforePrevious, callCount());
    Assert.Equal("s0", carousel.Current?.Id);
    Assert.Equal("https://img/s0-4k.jpg", preloadedUrl);
    Assert.False(carousel.HasPrevious);
  }

  [Fact]
  public async Task Previous_PreloadError_Propagates() {
    var failNext = false;

    var preloader = new FakePreloader {
      // ReSharper disable once AccessToModifiedClosure
      PreloadImpl = url => failNext
        ? throw new ImagePreloadFailedException(url)
        : Task.CompletedTask
    };

    var api = ScreenshotCarouselTests.SequentialApi(out _, "s0", "s1");

    var carousel = new ScreenshotCarousel(api, preloader, () => "4k");

    await carousel.Next();
    await carousel.PreloadAhead();
    await carousel.Next();

    failNext = true;

    await Assert.ThrowsAsync<ImagePreloadFailedException>(carousel.Previous);
  }

  [Fact]
  public async Task PreloadAhead_AppendsLookAhead_WithoutMovingCursor() {
    var api = ScreenshotCarouselTests.SequentialApi(out _, "s0", "s1");

    var carousel = new ScreenshotCarousel(api, new FakePreloader(), () => "4k");

    await carousel.Next();

    var currentBeforePreload = carousel.Current;

    await carousel.PreloadAhead();

    Assert.Equal(2, carousel.Count);
    Assert.Equal(0, carousel.CurrentIndex);
    Assert.Same(currentBeforePreload, carousel.Current);
  }

  /// <summary>
  /// Crown jewel #7: the dedupe loop refetches while the weighted-random endpoint keeps returning
  /// the screenshot already displayed and stops as soon as a different one arrives.
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

    var carousel = new ScreenshotCarousel(api, new FakePreloader(), () => "4k");

    await carousel.Next();
    await carousel.PreloadAhead();

    Assert.Equal(4, callCount());
    Assert.Equal(2, carousel.Count);

    await carousel.Next();

    Assert.Equal("s1", carousel.Current?.Id);
  }

  /// <summary>
  /// Crown jewel #6: once the window grows past its cap, the oldest screenshot is trimmed off the
  /// front and the cursor is adjusted so it keeps pointing at the same screenshot.
  /// </summary>
  [Fact]
  public async Task PreloadAhead_TrimsWindowAndKeepsCursorOnSameScreenshot() {
    // A counting endpoint that returns "s0", "s1", "s2"... so every fetch is distinct (the dedupe
    // loop never spins).
    var api = ScreenshotCarouselTests.CountingApi();

    var carousel = new ScreenshotCarousel(api, new FakePreloader(), () => "4k");

    // Drive the slideshow exactly as the system does: advance, then prefetch when at the end.
    for (var step = 0; step < 25; step++) {
      await carousel.Next();

      if (carousel.IsAtEnd) {
        await carousel.PreloadAhead();
      }
    }

    // The window is capped, and the cursor still points at the last screenshot advanced onto (the
    // 25th, "s24"), proving the trim adjusted the index rather than corrupting it.
    Assert.Equal(20, carousel.Count);
    Assert.Equal("s24", carousel.Current?.Id);
    Assert.True(carousel.CurrentIndex >= 0 && carousel.CurrentIndex < carousel.Count);
  }

  [Fact]
  public async Task ReplaceCurrent_SwapsInPlace_WithoutMovingCursor() {
    var carousel = new ScreenshotCarousel(
      ScreenshotCarouselTests.SequentialApi(out _, "s0"),
      new FakePreloader(),
      () => "4k"
    );

    await carousel.Next();

    var liked = carousel.Current! with { LikesCount = 99 };

    carousel.ReplaceCurrent(liked);

    Assert.Same(liked, carousel.Current);
    Assert.Equal(1, carousel.Count);
    Assert.Equal(0, carousel.CurrentIndex);
  }

  [Fact]
  public void ReplaceCurrent_WithNoCurrent_Throws() {
    var carousel = new ScreenshotCarousel(
      ScreenshotCarouselTests.SequentialApi(out _, "s0"),
      new FakePreloader(),
      () => "4k"
    );

    Assert.Throws<InvalidOperationException>(
      () => carousel.ReplaceCurrent(ScreenshotCarouselTests.MakeScreenshot("x"))
    );
  }

  #if DEBUG
  [Fact]
  public async Task LoadById_FetchesPreloadsAppendsAndAdvances() {
    string? preloadedUrl = null;

    var preloader = new FakePreloader {
      PreloadImpl = url => {
        preloadedUrl = url;

        return Task.CompletedTask;
      }
    };

    var api = new FakeApi {
      GetScreenshotImpl = id => Task.FromResult(ScreenshotCarouselTests.MakeScreenshot(id))
    };

    var carousel = new ScreenshotCarousel(api, preloader, () => "4k");

    await carousel.LoadById("abc");

    Assert.Equal("abc", carousel.Current?.Id);
    Assert.Equal(0, carousel.CurrentIndex);
    Assert.Equal(1, carousel.Count);
    Assert.Equal("https://img/abc-4k.jpg", preloadedUrl);
  }
  #endif

  private static Screenshot MakeScreenshot(string id) =>
    new() {
      Id = id,
      ImageUrlFHD = $"https://img/{id}-fhd.jpg",
      ImageUrl4K = $"https://img/{id}-4k.jpg"
    };

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
}
