using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Colossal.Json;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using HallOfFame.Tests.Logging;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class UsageTrackerTests {
  private static readonly UsageSession Session = new(
    "6f1c9a52-8d0b-4a8e-9f57-0c3e2b7d4a11",
    "1.2.3",
    "1.6.2f1",
    IsDebug: true
  );

  /// <summary>
  /// The envelope is the wire contract the server validates strictly, so it is asserted on the JSON
  /// the request carries, every field named.
  /// </summary>
  [Fact]
  public async Task Flush_PostsTheTrackedEvents_InTheAgreedEnvelope() {
    var posted = new List<UsageBatch>();

    var tracker = UsageTrackerTests.CreateTracker(new FakeUsageSettings(), posted);

    var before = DateTime.UtcNow;

    tracker.Track("capture_requested");

    tracker.Track(
      "context_entered",
      new Dictionary<string, object> {
        ["mode"] = "MainMenu",
        ["purpose"] = "LoadGame"
      }
    );

    var after = DateTime.UtcNow;

    await tracker.Flush();

    var body = (ProxyObject) JSON.Load(JSON.Dump(Assert.Single(posted).ToRequestBody()));

    Assert.Equal(
      ["debug", "events", "gameVersion", "modVersion", "sessionId"],
      body.Keys.OrderBy(key => key, StringComparer.Ordinal)
    );

    Assert.Equal("6f1c9a52-8d0b-4a8e-9f57-0c3e2b7d4a11", (string) body["sessionId"]);
    Assert.Equal("1.2.3", (string) body["modVersion"]);
    Assert.Equal("1.6.2f1", (string) body["gameVersion"]);
    Assert.True(body["debug"]);

    var events = Assert.IsType<ProxyArray>(body["events"]);

    Assert.Equal(2, events.Count);

    var capture = Assert.IsType<ProxyObject>(events[0]);

    Assert.Equal(
      ["at", "name", "properties"],
      capture.Keys.OrderBy(key => key, StringComparer.Ordinal)
    );

    Assert.Equal("capture_requested", (string) capture["name"]);
    Assert.Equal(0, capture["properties"].Count);

    // The server takes an ISO 8601 timestamp with an offset, the client's clock in UTC.
    var at = DateTime.Parse(
      (string) capture["at"],
      CultureInfo.InvariantCulture,
      DateTimeStyles.AdjustToUniversal | DateTimeStyles.AssumeUniversal
    );

    Assert.EndsWith("Z", (string) capture["at"]);
    Assert.InRange(at, before.AddMilliseconds(-1), after.AddMilliseconds(1));

    var context = Assert.IsType<ProxyObject>(events[1]);

    Assert.Equal("context_entered", (string) context["name"]);
    Assert.Equal("MainMenu", (string) context["properties"]["mode"]);
    Assert.Equal("LoadGame", (string) context["properties"]["purpose"]);
  }

  [Fact]
  public async Task Track_WhileTheSettingIsOff_DropsTheEvent() {
    var posted = new List<UsageBatch>();

    var settings = new FakeUsageSettings {
      SendUsageStatistics = false
    };

    var tracker = UsageTrackerTests.CreateTracker(settings, posted);

    tracker.Track("capture_requested");

    // Turning it back on before the flush sends nothing tracked while it was off.
    settings.SendUsageStatistics = true;

    tracker.Track("screenshot_captured");

    await tracker.Flush();

    Assert.Equal("screenshot_captured", Assert.Single(Assert.Single(posted).Events).Name);
  }

  [Fact]
  public async Task Flush_AfterTheSettingTurnedOff_DiscardsTheQueue() {
    var posted = new List<UsageBatch>();

    var settings = new FakeUsageSettings();

    var tracker = UsageTrackerTests.CreateTracker(settings, posted);

    tracker.Track("capture_requested");

    settings.SendUsageStatistics = false;

    await tracker.Flush();

    // Back on, the events queued before it turned off are gone for good.
    settings.SendUsageStatistics = true;

    await tracker.Flush();

    Assert.Empty(posted);
  }

  [Fact]
  public async Task Flush_WithNothingQueued_PostsNothing() {
    var posted = new List<UsageBatch>();

    var tracker = UsageTrackerTests.CreateTracker(new FakeUsageSettings(), posted);

    await tracker.Flush();

    Assert.Empty(posted);
  }

  [Fact]
  public async Task Flush_EmptiesTheBatch() {
    var posted = new List<UsageBatch>();

    var tracker = UsageTrackerTests.CreateTracker(new FakeUsageSettings(), posted);

    tracker.Track("capture_requested");

    await tracker.Flush();

    tracker.Track("screenshot_captured");

    await tracker.Flush();

    Assert.Equal(
      ["capture_requested", "screenshot_captured"],
      posted.Select(batch => Assert.Single(batch.Events).Name)
    );
  }

  /// <summary>
  /// The server rejects a batch over a hundred events whole, so the queue never grows near it.
  /// </summary>
  [Fact]
  public void Track_AtFiftyEvents_FlushesEarly() {
    var posted = new List<UsageBatch>();

    var tracker = UsageTrackerTests.CreateTracker(new FakeUsageSettings(), posted);

    for (var i = 0; i < 49; i++) {
      tracker.Track("slideshow_navigated");
    }

    Assert.Empty(posted);

    tracker.Track("slideshow_navigated");

    Assert.Equal(50, Assert.Single(posted).Events.Count);

    tracker.Track("slideshow_navigated");

    Assert.Single(posted);
  }

  /// <summary>
  /// The contract the fire-and-forget callers rely on, the view recorder's: a failed post is
  /// swallowed and logged silently, and its events are lost rather than posted again.
  /// </summary>
  [Fact]
  public async Task Flush_OnError_IsSwallowed_LoggedSilently_AndNotRetried() {
    var attempts = new List<UsageBatch>();

    var api = new FakeApi {
      PostUsageEventsImpl = batch => {
        attempts.Add(batch);

        return attempts.Count is 1
          ? Task.FromException(new InvalidOperationException("boom"))
          : Task.CompletedTask;
      }
    };

    var logged = new List<Exception>();

    var tracker = new UsageTracker(
      api,
      new FakeModLog {
        ErrorSilentImpl = logged.Add
      },
      new FakeUsageSettings(),
      UsageTrackerTests.Session
    );

    tracker.Track("capture_requested");

    // Must not throw, even though the API faulted.
    await tracker.Flush();

    tracker.Track("screenshot_captured");

    await tracker.Flush();

    Assert.IsType<InvalidOperationException>(Assert.Single(logged));

    Assert.Equal(
      ["capture_requested", "screenshot_captured"],
      attempts.Select(batch => Assert.Single(batch.Events).Name)
    );
  }

  [Fact]
  public void SessionHeader_IsTheSessionId_OnlyWhileTheSettingIsOn() {
    var settings = new FakeUsageSettings();

    var tracker = UsageTrackerTests.CreateTracker(settings, []);

    Assert.Equal("6f1c9a52-8d0b-4a8e-9f57-0c3e2b7d4a11", tracker.SessionHeader);

    settings.SendUsageStatistics = false;

    Assert.Null(tracker.SessionHeader);
  }

  private static UsageTracker CreateTracker(FakeUsageSettings settings, List<UsageBatch> posted) {
    var api = new FakeApi {
      PostUsageEventsImpl = batch => {
        posted.Add(batch);

        return Task.CompletedTask;
      }
    };

    return new UsageTracker(api, new FakeModLog(), settings, UsageTrackerTests.Session);
  }
}
