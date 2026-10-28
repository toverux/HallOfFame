using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace HallOfFame.Services;

/// <summary>
/// One game launch, as every usage event of it reports it: the session drawn at mod load, the
/// versions running, and whether the build is a debug one, which the dashboards leave out.
/// </summary>
/// <param name="Id">The random UUID drawn once per launch, also sent as the session header.</param>
/// <param name="ModVersion">The mod's version, in the <c>1.2.3</c> form.</param>
/// <param name="GameVersion">The game's short version, in the <c>1.6.2f1</c> form.</param>
/// <param name="IsDebug">Whether the mod is a debug build.</param>
internal sealed record UsageSession(string Id, string ModVersion, string GameVersion, bool IsDebug);

/// <summary>
/// A moment of the game's client the server cannot otherwise see, as <see cref="UsageTracker"/>
/// queues it.
/// </summary>
/// <param name="Name">The event name, ex. <c>capture_requested</c>.</param>
/// <param name="Properties">
/// Flat scalar properties: strings, numbers, and booleans.
/// A dictionary, as the JSON encoder writes an <c>IDictionary</c> only.
/// </param>
/// <param name="At">When it was tracked, in UTC.</param>
internal sealed record UsageEvent(
  string Name,
  Dictionary<string, object> Properties,
  DateTime At
);

/// <summary>
/// A batch of usage events posted in one request, the session sent once for all of them.
/// </summary>
internal sealed record UsageBatch(UsageSession Session, IReadOnlyList<UsageEvent> Events) {
  /// <summary>
  /// The request body, the envelope the server validates strictly: an unknown field rejects the
  /// whole batch.
  /// </summary>
  internal Dictionary<string, object> ToRequestBody() =>
    new() {
      ["sessionId"] = this.Session.Id,
      ["modVersion"] = this.Session.ModVersion,
      ["gameVersion"] = this.Session.GameVersion,
      ["debug"] = this.Session.IsDebug,
      ["events"] = this.Events
        .Select(UsageBatch.ToRequestEvent)
        .ToList()
    };

  private static Dictionary<string, object> ToRequestEvent(UsageEvent usageEvent) =>
    new() {
      ["name"] = usageEvent.Name,
      ["properties"] = usageEvent.Properties,
      // Formatted here, as the JSON encoder writes a date with no offset, which the server refuses.
      ["at"] = usageEvent.At.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture)
    };
}
