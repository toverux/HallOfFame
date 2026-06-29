using System;
using HallOfFame.Services;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class NavigationStateTests {
  [Fact]
  public void Initial_IsIdle() {
    var state = new NavigationState();

    NavigationStateTests.AssertState(
      state,
      canAdvance: true,
      canLike: true,
      isRefreshing: false
    );
  }

  [Fact]
  public void Begin_EntersNavigating() {
    var state = new NavigationState();

    state.Begin();

    // Navigation has the lock: nothing else may start, and the current screenshot cannot be liked
    // while it may be swapped out.
    NavigationStateTests.AssertState(
      state,
      canAdvance: false,
      canLike: false,
      isRefreshing: true
    );
  }

  [Fact]
  public void Settle_WithPreloadAhead_EntersPrefetching_AllowingLike() {
    var state = new NavigationState();

    state.Begin();
    state.Settle(shouldPreloadAhead: true);

    // The like-during-prefetch gap: the current screenshot is settled, but the background prefetch
    // keeps the refresh lock held, so a like is now allowed while a forward move still is not.
    NavigationStateTests.AssertState(
      state,
      canAdvance: false,
      canLike: true,
      isRefreshing: true
    );
  }

  [Fact]
  public void EndPrefetch_ReturnsToIdle() {
    var state = new NavigationState();

    state.Begin();
    state.Settle(shouldPreloadAhead: true);
    state.EndPrefetch();

    NavigationStateTests.AssertState(
      state,
      canAdvance: true,
      canLike: true,
      isRefreshing: false
    );
  }

  [Fact]
  public void Settle_WithoutPreloadAhead_ReturnsToIdle() {
    var state = new NavigationState();

    state.Begin();

    // The scrollback path: nothing to prefetch, so the lock is released right away.
    state.Settle(shouldPreloadAhead: false);

    NavigationStateTests.AssertState(
      state,
      canAdvance: true,
      canLike: true,
      isRefreshing: false
    );
  }

  [Fact]
  public void Abort_ReturnsToIdle() {
    var state = new NavigationState();

    state.Begin();
    state.Abort();

    NavigationStateTests.AssertState(
      state,
      canAdvance: true,
      canLike: true,
      isRefreshing: false
    );
  }

  [Fact]
  public void Begin_WhenNotIdle_Throws() {
    var state = new NavigationState();

    state.Begin();

    Assert.Throws<InvalidOperationException>(state.Begin);
  }

  [Fact]
  public void Settle_WhenNotNavigating_Throws() {
    var state = new NavigationState();

    Assert.Throws<InvalidOperationException>(() => state.Settle(shouldPreloadAhead: true));
  }

  [Fact]
  public void Abort_WhenNotNavigating_Throws() {
    var state = new NavigationState();

    Assert.Throws<InvalidOperationException>(state.Abort);
  }

  [Fact]
  public void EndPrefetch_WhenNotPrefetching_Throws() {
    var state = new NavigationState();

    Assert.Throws<InvalidOperationException>(state.EndPrefetch);
  }

  /// <summary>
  /// Centerpiece: drives a full forward navigation that lands at the front of the window, so it
  /// settles into a background prefetch before returning to idle, asserting the lock acquires and
  /// releases at every step.
  /// This is the sequence candidate #2 could not test because the lock lived as a pair of binding
  /// flags inside the engine-bound system.
  /// </summary>
  [Fact]
  public void ForwardNavigationWithPrefetch_TracksLockAcquireAndRelease() {
    var state = new NavigationState();

    // Acquire: a forward navigation is in flight.
    state.Begin();

    NavigationStateTests.AssertState(
      state,
      canAdvance: false,
      canLike: false,
      isRefreshing: true
    );

    // Settled onto the new screenshot, but the look-ahead prefetch keeps the lock held: a like is
    // now allowed, a forward move is still not.
    state.Settle(shouldPreloadAhead: true);

    NavigationStateTests.AssertState(
      state,
      canAdvance: false,
      canLike: true,
      isRefreshing: true
    );

    // Release: the prefetch is done, the lock is fully released.
    state.EndPrefetch();

    NavigationStateTests.AssertState(
      state,
      canAdvance: true,
      canLike: true,
      isRefreshing: false
    );
  }

  private static void AssertState(
    NavigationState state,
    bool canAdvance,
    bool canLike,
    bool isRefreshing
  ) {
    Assert.Equal(canAdvance, state.CanAdvance);
    Assert.Equal(canLike, state.CanLike);
    Assert.Equal(isRefreshing, state.IsRefreshing);
  }
}
