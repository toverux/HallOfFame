using System;

namespace HallOfFame.Services;

/// <summary>
/// The single-threaded phase model behind the main-menu slideshow's navigation lock: it owns the
/// phases a refresh moves through (idle, navigating, then optionally a background look-ahead
/// prefetch) and the derived facts the driving system gates its interactions on.
/// It carries no engine types and no dependencies, so it constructs off-engine like
/// <see cref="ScreenshotCarousel"/>, which is what makes the lock acquire/release unit-testable in
/// isolation; the driving <c>PresenterUISystem</c> mirrors <see cref="CanAdvance"/> onto its
/// binding after every transition.
/// Each transition throws <see cref="InvalidOperationException"/> on an illegal source phase, the
/// same misuse-throws contract as the carousel, so callers guard with the derived facts first.
/// </summary>
internal sealed class NavigationState {
  private Phase phase = Phase.Idle;

  /// <summary>
  /// Whether a refresh is in progress: either a navigation is moving the cursor or the background
  /// look-ahead prefetch that may follow it is still running.
  /// </summary>
  internal bool IsRefreshing => this.phase is Phase.Navigating or Phase.Prefetching;

  /// <summary>
  /// Whether a forward/backward navigation may start: only when fully idle, so neither a navigation
  /// nor a background prefetch is in progress.
  /// </summary>
  internal bool CanAdvance => this.phase is Phase.Idle;

  /// <summary>
  /// Whether the current screenshot may be liked.
  /// This is broader than <see cref="CanAdvance"/>: a like acts on the already-settled current
  /// screenshot, so it is only blocked mid-navigation, which may be swapping that screenshot out.
  /// It stays allowed during the background look-ahead prefetch that follows, when the current
  /// screenshot is settled even though <see cref="IsRefreshing"/> remains set.
  /// </summary>
  internal bool CanLike => this.phase is not Phase.Navigating;

  /// <summary>
  /// Acquires the navigation lock at the start of a forward/backward move.
  /// </summary>
  /// <exception cref="InvalidOperationException">
  /// When not idle; the caller is expected to guard with <see cref="CanAdvance"/>.
  /// </exception>
  internal void Begin() {
    if (this.phase is not Phase.Idle) {
      throw new InvalidOperationException(
        $"Cannot begin a navigation: not idle (phase is {this.phase})."
      );
    }

    this.phase = Phase.Navigating;
  }

  /// <summary>
  /// Settles a navigation onto its new screenshot: moves into the background prefetch phase when
  /// there is a look-ahead to prefetch, otherwise releases the lock right away (the scrollback
  /// path).
  /// </summary>
  /// <param name="shouldPreloadAhead">
  /// Whether a background look-ahead prefetch will follow, keeping the lock held until it ends.
  /// </param>
  /// <exception cref="InvalidOperationException">
  /// When not navigating.
  /// </exception>
  internal void Settle(bool shouldPreloadAhead) {
    if (this.phase is not Phase.Navigating) {
      throw new InvalidOperationException(
        $"Cannot settle a navigation: not navigating (phase is {this.phase})."
      );
    }

    this.phase = shouldPreloadAhead ? Phase.Prefetching : Phase.Idle;
  }

  /// <summary>
  /// Releases the lock once the background look-ahead prefetch has finished.
  /// </summary>
  /// <exception cref="InvalidOperationException">
  /// When no prefetch is in progress.
  /// </exception>
  internal void EndPrefetch() {
    if (this.phase is not Phase.Prefetching) {
      throw new InvalidOperationException(
        $"Cannot end a prefetch: none in progress (phase is {this.phase})."
      );
    }

    this.phase = Phase.Idle;
  }

  /// <summary>
  /// Releases the lock after a navigation failed to load, leaving the previously displayed
  /// screenshot in place.
  /// </summary>
  /// <exception cref="InvalidOperationException">
  /// When not navigating.
  /// </exception>
  internal void Abort() {
    if (this.phase is not Phase.Navigating) {
      throw new InvalidOperationException(
        $"Cannot abort a navigation: not navigating (phase is {this.phase})."
      );
    }

    this.phase = Phase.Idle;
  }

  private enum Phase { Idle, Navigating, Prefetching }
}
