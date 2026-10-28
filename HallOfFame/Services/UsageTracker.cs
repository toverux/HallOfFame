using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using HallOfFame.Http;
using HallOfFame.Logging;

namespace HallOfFame.Services;

/// <summary>
/// Queues the usage events of a game launch in memory and posts them to the server in batches, the
/// moments of the game's client the server cannot otherwise see.
/// <para>
/// Everything it adds is gated by <see cref="IUsageSettings.SendUsageStatistics"/>, read at each
/// call: while it is off, an event is dropped as it is tracked, the queue is discarded at the next
/// flush, and <see cref="SessionHeader"/> gives nothing for the HTTP layer to send.
/// </para>
/// <para>
/// The flush schedule (an interval, each loading completion, the quit) belongs to the hosting
/// system; this only flushes early when the queue reaches <see cref="EarlyFlushThreshold"/>.
/// The queue lives in memory alone, so a killed game loses what it holds.
/// Accessed only from the main thread, like the triggers and the systems calling it, so it needs no
/// synchronization.
/// </para>
/// </summary>
/// <param name="api">Server API the batches are posted to.</param>
/// <param name="log">Mod logger, for the failed posts.</param>
/// <param name="settings">Narrow seam over the player's toggle.</param>
/// <param name="session">The launch every event reports, sent once per batch.</param>
internal sealed class UsageTracker(
  IHallOfFameApi api,
  IModLog log,
  IUsageSettings settings,
  UsageSession session
) {
  /// <summary>
  /// The queue size that flushes at once, half the server's limit of a hundred events per batch, so
  /// a batch never reaches it: change both together.
  /// </summary>
  internal const int EarlyFlushThreshold = 50;

  /// <summary>
  /// The events tracked since the last flush.
  /// Mutable, as a flush hands the list over to its batch and starts a new one.
  /// </summary>
  private List<UsageEvent> queue = [];

  /// <summary>
  /// The value of the session header the HTTP layer sends on each request to the mod's API, or
  /// <c>null</c> while the player does not allow usage statistics, when no header is sent.
  /// </summary>
  internal string? SessionHeader => settings.SendUsageStatistics ? session.Id : null;

  /// <summary>
  /// Queues an event, stamped with the current time, unless the player does not allow usage
  /// statistics.
  /// Flushes at once when the queue reaches <see cref="EarlyFlushThreshold"/>.
  /// </summary>
  /// <param name="name">The event name, ex. <c>capture_requested</c>.</param>
  /// <param name="properties">Flat scalar properties: strings, numbers, and booleans.</param>
  internal void Track(string name, Dictionary<string, object>? properties = null) {
    if (!settings.SendUsageStatistics) {
      return;
    }

    this.queue.Add(new UsageEvent(name, properties ?? [], DateTime.UtcNow));

    if (this.queue.Count >= UsageTracker.EarlyFlushThreshold) {
      _ = this.Flush();
    }
  }

  /// <summary>
  /// Posts the queued events, unless there are none, or discards them when the player no longer
  /// allows usage statistics.
  /// A failed post is invisible to the player and its events are lost, never posted again, so this
  /// is designed never to throw, and the caller can fire-and-forget it.
  /// </summary>
  internal async Task Flush() {
    if (this.queue.Count is 0) {
      return;
    }

    var batch = new UsageBatch(session, this.queue);

    // Taken before the post, so the events tracked while it is on their way wait for the next one.
    this.queue = [];

    if (!settings.SendUsageStatistics) {
      return;
    }

    try {
      await api.PostUsageEvents(batch);
    }
    catch (Exception ex) {
      log.ErrorSilent(ex);
    }
  }
}
