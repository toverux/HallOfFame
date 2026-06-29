using System;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;
using HallOfFame.Logging;

namespace HallOfFame.Services;

/// <summary>
/// Owns the lifecycle that decides whether the creator's stats are notable enough to surface in a
/// main-menu notification: the reentrancy guard, the fetch, the "notable enough" product rule, and
/// the split between a silently logged network error and a recoverable one.
/// The engine-bound presentation stays with the host system, reached through the injected
/// <paramref name="showNotification"/> callback, so this service constructs and runs off-engine
/// like <see cref="ScreenshotViewRecorder"/> and <see cref="ScreenshotLiker"/>.
/// </summary>
internal sealed class StatsNotifier(
  IHallOfFameApi api,
  IModLog log,
  Action<CreatorStats> showNotification
) {
  /// <summary>
  /// Minimum number of likes for the stats to be deemed notable enough to notify the creator.
  /// </summary>
  private const int MinLikesToNotify = 2;

  private State state = State.Idle;

  /// <summary>
  /// Fetches the creator's stats and, when they are notable enough, hands them to the injected
  /// notification callback.
  /// <para>
  /// <see cref="State.Shown"/> is the only terminal state: once a notable result has been surfaced,
  /// further calls are no-ops for the rest of the session.
  /// A below-threshold result or any failure falls back to <see cref="State.Idle"/>, so a later
  /// return to the main menu re-fetches and can surface the notification once the creator crosses
  /// the threshold mid-session.
  /// <see cref="State.Loading"/> is purely the reentrancy guard: a second call while a fetch is in
  /// flight is a no-op, so the stats are never fetched twice concurrently.
  /// </para>
  /// Designed never to throw, so the caller can fire-and-forget it.
  /// </summary>
  internal async Task ShowIfNotable() {
    // A notable result has already been shown, or a fetch is in flight: nothing to do.
    if (this.state is State.Loading or State.Shown) {
      return;
    }

    this.state = State.Loading;

    try {
      var stats = await api.GetCreatorStats();

      if (stats.LikesCount >= StatsNotifier.MinLikesToNotify) {
        showNotification(stats);

        this.state = State.Shown;
      }
    }
    catch (HttpException ex) {
      // Expected transient network/server failure: log it without surfacing a dialog.
      log.ErrorSilent(ex);
    }
    catch (Exception ex) {
      // Unexpected failure: surface it as recoverable.
      log.ErrorRecoverable(ex);
    }
    finally {
      // Below-threshold and any failure leave the state at Loading here, returning it to Idle so
      // the attempt is retried on a later return to the main menu.
      // A notable show set it to Shown and is left untouched.
      if (this.state is State.Loading) {
        this.state = State.Idle;
      }
    }
  }

  private enum State { Idle, Loading, Shown }
}
