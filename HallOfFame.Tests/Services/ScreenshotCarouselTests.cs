using System;
using System.Collections.Generic;
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
  public async Task Next_OnEmpty_FetchesPreloadsAndSetsCurrent() {
    var carousel = new ScreenshotCarousel(
      ScreenshotCarouselTests.SequentialApi(out _, "s0"),
      new FakePreloader(),
      () => "4k"
    );

    var step = await carousel.Next();

    // Landing on the freshly fetched screenshot is a first display at the front of the window: it
    // should preload ahead and counts as a view.
    Assert.Equal("s0", step.Current.Id);
    Assert.True(step.ShouldPreloadAhead);
    Assert.Equal("s0", step.ViewedScreenshotId);

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

    var step = await carousel.Next();

    Assert.Equal(callsBeforeAdvance, callCount());

    // The cursor moved onto the prefetched look-ahead, which is now the window's front: still a
    // first display, so it preloads ahead and counts as a view.
    Assert.Equal("s1", step.Current.Id);
    Assert.True(step.ShouldPreloadAhead);
    Assert.Equal("s1", step.ViewedScreenshotId);

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

    var step = await carousel.Previous();

    Assert.Equal(callsBeforePrevious, callCount());

    // Scrolling back lands on an already-seen screenshot with look-ahead still ahead of it: the
    // degenerate step neither preloads ahead nor re-counts the view.
    Assert.Equal("s0", step.Current.Id);
    Assert.False(step.ShouldPreloadAhead);
    Assert.Null(step.ViewedScreenshotId);

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

  /// <summary>
  /// Forward through scrollback: after stepping back into the window, moving forward again lands on
  /// an already-seen middle screenshot (<see cref="ScreenshotCarousel.IsAtEnd"/> is false), so the
  /// step must neither preload ahead nor re-count the view.
  /// </summary>
  [Fact]
  public async Task Next_AfterScrollback_OntoMiddle_DoesNotPreloadOrCountView() {
    var carousel = new ScreenshotCarousel(
      ScreenshotCarouselTests.CountingApi(),
      new FakePreloader(),
      () => "4k"
    );

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
    Assert.Null(step.ViewedScreenshotId);
    Assert.False(carousel.IsAtEnd);
  }

  /// <summary>
  /// Centerpiece: a scripted walk goes forward, scrolls back over seen screenshots, then forward
  /// again past them into fresh territory. Every distinct screenshot is reported viewed exactly
  /// once, on its first display. Re-displaying a screenshot on scrollback or scroll-forward must
  /// never re-count it.
  /// </summary>
  [Fact]
  public async Task ViewedScreenshotId_OverScriptedWalk_ReportsEachFirstDisplayOnce() {
    var carousel = new ScreenshotCarousel(
      ScreenshotCarouselTests.CountingApi(),
      new FakePreloader(),
      () => "4k"
    );

    // The leading three forward steps (rather than two as one might first reach for) are what make
    // the two scrollback steps valid: two Previous moves need the cursor to sit at index >= 2.
    var steps = await ScreenshotCarouselTests.Drive(
      carousel,
      Move.Next,
      Move.Next,
      Move.Next,
      Move.Previous,
      Move.Previous,
      Move.Next,
      Move.Next,
      Move.Next
    );

    var viewed = steps
      .Select(step => step.ViewedScreenshotId)
      .OfType<string>()
      .ToList();

    // s1 and s2 are re-displayed during the forward replay after scrollback, yet never re-reported;
    // s3 is reported only when the replay crosses into never-seen territory.
    Assert.Equal(new[] { "s0", "s1", "s2", "s3" }, viewed);
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

    var carousel = new ScreenshotCarousel(api, new FakePreloader(), () => "4k");

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
    var carousel = new ScreenshotCarousel(
      ScreenshotCarouselTests.CountingApi(),
      new FakePreloader(),
      () => "4k"
    );

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

    Assert.Throws<InvalidOperationException>(() =>
      carousel.ReplaceCurrent(ScreenshotCarouselTests.MakeScreenshot("x"))
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

    var step = await carousel.LoadById("abc");

    // Loading by ID lands at the front of the window, so its step behaves like any other forward
    // move: it preloads ahead and counts as a view.
    Assert.Equal("abc", step.Current.Id);
    Assert.True(step.ShouldPreloadAhead);
    Assert.Equal("abc", step.ViewedScreenshotId);

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
  /// Drives the carousel the way <c>PresenterUISystem</c> does: each move applies its returned
  /// <see cref="NavigationStep"/>, and a step that asks to preload ahead triggers the look-ahead
  /// prefetch (the system fires it in the background; here it is awaited so the window settles).
  /// Returns the emitted steps in order, so a test can collect the viewed ids or inspect any step.
  /// </summary>
  private static async Task<IReadOnlyList<NavigationStep>> Drive(
    ScreenshotCarousel carousel,
    params Move[] moves
  ) {
    var steps = new List<NavigationStep>();

    foreach (var move in moves) {
      var step = move switch {
        Move.Next => await carousel.Next(),
        Move.Previous => await carousel.Previous(),
        _ => throw new ArgumentOutOfRangeException(nameof(moves), move, null)
      };

      steps.Add(step);

      if (step.ShouldPreloadAhead) {
        await carousel.PreloadAhead();
      }
    }

    return steps;
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
