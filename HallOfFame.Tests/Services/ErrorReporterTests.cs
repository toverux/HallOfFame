using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Threading.Tasks;
using Colossal.Json;
using HallOfFame.Http;
using HallOfFame.Logging;
using HallOfFame.Services;
using HallOfFame.Tests.Http;
using Xunit;

namespace HallOfFame.Tests.Services;

public sealed class ErrorReporterTests {
  private static readonly ErrorContext Context = new() {
    ModVersion = "1.2.3",
    GameVersion = "1.6.4f1",
    IsDebug = false,
    Platform = "Windows 11  (10.0.22631) 64bit",
    IsWine = true,
    ScreenWidth = 2560,
    ScreenHeight = 1440,
    GpuName = "NVIDIA GeForce RTX 3060 Laptop GPU",
    GpuVendor = "NVIDIA",
    GpuDriverVersion = "32.0.15.6094",
    Locale = "fr-FR"
  };

  /// <summary>
  /// Mono's text of an exception thrown after an await, with an inner exception, captured in the
  /// running game.
  /// </summary>
  private const string MonoExceptionText =
    "System.InvalidOperationException: Probe: thrown after an await. ---> " +
    "System.InvalidOperationException: Probe: the inner cause.\r\n" +
    "  at HallOfFame.Probe.InnerThrower (System.String message) [0x00001] in " +
    "/home/user/Documents/Dev/HallOfFame/HallOfFame/Probe.cs:66 \r\n" +
    "  at HallOfFame.Probe.ThrowAfterAwait () [0x0006e] in " +
    "/home/user/Documents/Dev/HallOfFame/HallOfFame/Probe.cs:85 \r\n" +
    "   --- End of inner exception stack trace ---\r\n" +
    "  at HallOfFame.Probe.ThrowAfterAwait () [0x00085] in " +
    "/home/user/Documents/Dev/HallOfFame/HallOfFame/Probe.cs:88 \r\n" +
    "  at HallOfFame.Probe.AwaitProbe () [0x00023] in " +
    "/home/user/Documents/Dev/HallOfFame/HallOfFame/Probe.cs:72 ";

  /// <summary>
  /// Mono's text of an exception built and never thrown, captured in the running game.
  /// </summary>
  private const string NeverThrownExceptionText =
    "System.Exception: Failed to find field m_Count in ScreenUtility.";

  private readonly List<ErrorReport> posted = [];

  private readonly List<Action> mainThread = [];

  private readonly FakeUsageSettings settings = new();

  private readonly ErrorReporter reporter;

  public ErrorReporterTests() {
    var api = new FakeApi {
      PostErrorReportImpl = report => {
        this.posted.Add(report);

        return Task.CompletedTask;
      }
    };

    this.reporter = this.CreateReporter(api);
  }

  /// <summary>
  /// The body is the wire contract the server validates strictly, so it is asserted on the JSON the
  /// request carries, every field named.
  /// </summary>
  [Fact]
  public void ReportException_PostsTheErrorAndTheContext_InTheAgreedBody() {
    var exception = ErrorReporterTests.Thrown(() => new InvalidOperationException("boom"));

    this.reporter.ReportException(exception, ErrorSeverity.Recoverable);

    var body = this.SendAndReadSingleBody();

    Assert.Equal(
      ["context", "message", "severity", "source", "stack", "type"],
      body.Keys.OrderBy(key => key, StringComparer.Ordinal)
    );

    Assert.Equal("log", (string) body["source"]);
    Assert.Equal("recoverable", (string) body["severity"]);
    Assert.Equal("System.InvalidOperationException", (string) body["type"]);
    Assert.Equal("boom", (string) body["message"]);
    Assert.Equal(exception.ToString(), (string) body["stack"]);

    var context = Assert.IsType<ProxyObject>(body["context"]);

    Assert.Equal(
      [
        "debug",
        "gameVersion",
        "gpuDriverVersion",
        "gpuName",
        "gpuVendor",
        "locale",
        "modVersion",
        "platform",
        "screenHeight",
        "screenWidth",
        "wine"
      ],
      context.Keys.OrderBy(key => key, StringComparer.Ordinal)
    );

    Assert.Equal("1.2.3", (string) context["modVersion"]);
    Assert.Equal("1.6.4f1", (string) context["gameVersion"]);
    Assert.False(context["debug"]);
    Assert.Equal("Windows 11  (10.0.22631) 64bit", (string) context["platform"]);
    Assert.True(context["wine"]);
    Assert.Equal(2560, (int) context["screenWidth"]);
    Assert.Equal(1440, (int) context["screenHeight"]);
    Assert.Equal("NVIDIA GeForce RTX 3060 Laptop GPU", (string) context["gpuName"]);
    Assert.Equal("NVIDIA", (string) context["gpuVendor"]);
    Assert.Equal("32.0.15.6094", (string) context["gpuDriverVersion"]);
    Assert.Equal("fr-FR", (string) context["locale"]);
  }

  [Fact]
  public void ReportException_SendsEachSeverity() {
    this.reporter.ReportException(new Exception("a"), ErrorSeverity.Silent);
    this.reporter.ReportException(new Exception("b"), ErrorSeverity.Fatal);

    this.RunMainThread();

    Assert.Equal(
      ["silent", "fatal"],
      this.posted.Select(report => (string) report.ToRequestBody()["severity"])
    );
  }

  /// <summary>
  /// The schema refuses a null and an empty string alike, so a context value the mod failed to read
  /// is left out.
  /// </summary>
  [Fact]
  public void ReportException_LeavesOutTheContextTheModFailedToRead() {
    var reporter = this.CreateReporter(
      this.RecordingApi(),
      ErrorReporterTests.Context with {
        Platform = null,
        IsWine = null,
        ScreenWidth = null,
        ScreenHeight = 0,
        GpuName = "",
        GpuVendor = " ",
        GpuDriverVersion = null,
        Locale = null
      }
    );

    reporter.ReportException(new InvalidOperationException(), ErrorSeverity.Silent);

    var context = Assert.IsType<ProxyObject>(this.SendAndReadSingleBody()["context"]);

    Assert.Equal(
      ["debug", "gameVersion", "modVersion"],
      context.Keys.OrderBy(key => key, StringComparer.Ordinal)
    );
  }

  /// <summary>
  /// The server refuses a report with a field over its bound whole, so each is cut to it.
  /// </summary>
  [Fact]
  public void ReportException_CutsEachFieldToTheServersBound() {
    var reporter = this.CreateReporter(
      this.RecordingApi(),
      ErrorReporterTests.Context with {
        ModVersion = new string('m', 40),
        GameVersion = new string('g', 40),
        Platform = new string('p', 200),
        GpuName = new string('n', 200),
        GpuVendor = new string('v', 200),
        GpuDriverVersion = new string('d', 200),
        Locale = new string('l', 20),
        ScreenWidth = 40000
      }
    );

    // 4,095 letters then an emoji, two code units, which a cut at 4,096 would split.
    var message = new string('x', 4095) + "\U0001F600" + new string('y', 10);

    reporter.ReportException(new LongStackException(message), ErrorSeverity.Silent);

    var body = this.SendAndReadSingleBody();

    Assert.Equal(new string('x', 4095), (string) body["message"]);
    Assert.Equal(16384, ((string) body["stack"]).Length);

    var context = Assert.IsType<ProxyObject>(body["context"]);

    Assert.Equal(32, ((string) context["modVersion"]).Length);
    Assert.Equal(32, ((string) context["gameVersion"]).Length);
    Assert.Equal(128, ((string) context["platform"]).Length);
    Assert.Equal(128, ((string) context["gpuName"]).Length);
    Assert.Equal(128, ((string) context["gpuVendor"]).Length);
    Assert.Equal(128, ((string) context["gpuDriverVersion"]).Length);
    Assert.Equal(16, ((string) context["locale"]).Length);
    Assert.DoesNotContain("screenWidth", context.Keys);
  }

  [Fact]
  public void ReportException_WhileTheSettingIsOff_SendsNothing_AndKeepsTheErrorForLater() {
    var exception = ErrorReporterTests.Thrown(() => new InvalidOperationException());

    this.settings.SendUsageStatistics = false;

    this.reporter.ReportException(exception, ErrorSeverity.Silent);
    this.RunMainThread();

    Assert.Empty(this.posted);

    // Read at each call: back on, the same error goes out, as it was never counted.
    this.settings.SendUsageStatistics = true;

    this.reporter.ReportException(exception, ErrorSeverity.Silent);
    this.RunMainThread();

    Assert.Single(this.posted);
  }

  [Fact]
  public void QueuedReport_IsDropped_OnceTheSettingTurnedOff() {
    this.reporter.ReportException(new InvalidOperationException(), ErrorSeverity.Silent);

    this.settings.SendUsageStatistics = false;

    this.RunMainThread();

    Assert.Empty(this.posted);
  }

  /// <summary>
  /// Debug builds turn the reporter off, so development errors stay out of the project.
  /// </summary>
  [Fact]
  public void ReportEachSource_WhileDisabled_SendsNothing() {
    this.reporter.IsEnabled = false;

    this.reporter.ReportException(new InvalidOperationException(), ErrorSeverity.Fatal);
    this.reporter.ReportUIError(isFatal: true, "TypeError: boom");
    this.reporter.ReportEscaped("SceneFlow", ErrorReporterTests.Probe());

    this.RunMainThread();

    Assert.Empty(this.posted);
  }

  /// <summary>
  /// An HTTP failure is foreseen, its cause the network or a server that reports its own errors,
  /// except for a body the mod could not decode, a wire format mismatch on the mod's side.
  /// </summary>
  [Fact]
  public void ReportException_LeavesOutHttpExceptions_ButTheUndecodableResponse() {
    var error = new HttpQueries.JsonError();

    this.reporter.ReportException(new HttpNetworkException("1", "offline"), ErrorSeverity.Silent);
    this.reporter.ReportException(new HttpUserException("2", error), ErrorSeverity.Recoverable);
    this.reporter.ReportException(new HttpServerException("3", error), ErrorSeverity.Recoverable);

    this.reporter.ReportException(
      new HttpUserCompatibilityException("4", error),
      ErrorSeverity.Recoverable
    );

    this.reporter.ReportException(
      new HttpNetworkException("5", "Failed to parse JSON response") {
        IsUndecodable = true
      },
      ErrorSeverity.Silent
    );

    this.RunMainThread();

    var report = Assert.Single(this.posted);

    Assert.Equal(typeof(HttpNetworkException).FullName, report.Type);
  }

  /// <summary>
  /// A looping error, raised every frame with an ID in its message, goes out once.
  /// </summary>
  [Fact]
  public void SameError_WithAnotherMessage_IsSentOnce() {
    for (var i = 0; i < 3; i++) {
      this.reporter.ReportException(
        ErrorReporterTests.ThrowFromTheSameSite($"Screenshot #{i} not found."),
        ErrorSeverity.Silent
      );
    }

    this.RunMainThread();

    Assert.Equal("Screenshot #0 not found.", Assert.Single(this.posted).Message);
  }

  /// <summary>
  /// An undecodable response is logged where it is parsed, then rethrown and logged again by the
  /// caller, its stack longer by the frames it crossed.
  /// </summary>
  [Fact]
  public void ReportException_SameExceptionAgain_OnceItsStackGrew_IsSentOnce() {
    try {
      this.ReportAndRethrow();
    }
    catch (Exception ex) {
      this.reporter.ReportException(ex, ErrorSeverity.Silent);
    }

    this.RunMainThread();

    Assert.Single(this.posted);
  }

  [Fact]
  public void SameStack_FromAnotherSourceOrOfAnotherType_IsAnotherError() {
    var first = ErrorReporterTests.Thrown(() => new InvalidOperationException());
    var otherType = ErrorReporterTests.Thrown(() => new ArgumentException());

    this.reporter.ReportException(first, ErrorSeverity.Silent);
    this.reporter.ReportException(otherType, ErrorSeverity.Silent);
    this.reporter.ReportEscaped("SceneFlow", ErrorReporterTests.Probe());
    this.reporter.ReportException(ErrorReporterTests.Probe(), ErrorSeverity.Silent);

    this.RunMainThread();

    Assert.Equal(
      [ErrorSource.Log, ErrorSource.Log, ErrorSource.Escaped, ErrorSource.Log],
      this.posted.Select(report => report.Source)
    );
  }

  /// <summary>
  /// An exception built and never thrown has no stack, as a reflection accessor's: its message
  /// stands in for it, or every such error would count as one.
  /// </summary>
  [Fact]
  public void StacklessErrors_AreToldApartByTheirMessage() {
    this.reporter.ReportException(new Exception("Failed to find field A."), ErrorSeverity.Silent);
    this.reporter.ReportException(new Exception("Failed to find field B."), ErrorSeverity.Silent);
    this.reporter.ReportException(new Exception("Failed to find field A."), ErrorSeverity.Silent);

    this.RunMainThread();

    Assert.Equal(
      ["Failed to find field A.", "Failed to find field B."],
      this.posted.Select(report => report.Message)
    );
  }

  /// <summary>
  /// A wrapping exception, as a reflection call's, is the same at every throw: what it wraps tells
  /// the errors apart.
  /// </summary>
  [Fact]
  public void SameWrapper_AroundAnotherInnerError_IsAnotherError() {
    var argument = ErrorReporterTests.Thrown(() => new ArgumentException());
    var format = ErrorReporterTests.Thrown(() => new FormatException());

    this.reporter.ReportException(
      new InvalidOperationException("wrapper", argument),
      ErrorSeverity.Silent
    );

    this.reporter.ReportException(
      new InvalidOperationException("wrapper", format),
      ErrorSeverity.Silent
    );

    this.RunMainThread();

    Assert.Equal(2, this.posted.Count);
  }

  [Fact]
  public void ASession_SendsTenReports_EverySourceCountedTogether() {
    for (var i = 0; i < 6; i++) {
      this.reporter.ReportException(new Exception($"Log error {i}."), ErrorSeverity.Silent);
    }

    for (var i = 0; i < 6; i++) {
      this.reporter.ReportUIError(isFatal: false, $"TypeError: UI error {i}");
    }

    this.RunMainThread();

    Assert.Equal(ErrorReporter.MaxReportsPerSession, this.posted.Count);

    Assert.Equal(
      [6, 4],
      this.posted.GroupBy(report => report.Source).Select(group => group.Count())
    );
  }

  /// <summary>
  /// A report counts as sent when it is queued, so an error raised every frame while its request is
  /// on its way goes out once.
  /// </summary>
  [Fact]
  public void ErrorRaisedAgain_BeforeItsRequestEnds_IsSentOnce() {
    var pending = new TaskCompletionSource<bool>();
    var attempts = 0;

    var reporter = this.CreateReporter(
      new FakeApi {
        PostErrorReportImpl = _ => {
          attempts++;

          return pending.Task;
        }
      }
    );

    var exception = ErrorReporterTests.Thrown(() => new InvalidOperationException());

    reporter.ReportException(exception, ErrorSeverity.Silent);
    this.RunMainThread();

    reporter.ReportException(exception, ErrorSeverity.Silent);
    this.RunMainThread();

    pending.SetResult(true);

    Assert.Equal(1, attempts);
  }

  /// <summary>
  /// A report raised off the main thread waits for the main thread to be sent, as the HTTP layer
  /// runs there.
  /// </summary>
  [Fact]
  public async Task ReportFromAWorkerThread_IsSentFromTheMainThreadQueue() {
    await Task.Run(
      () => this.reporter.ReportException(new InvalidOperationException(), ErrorSeverity.Silent),
      TestContext.Current.CancellationToken
    );

    Assert.Empty(this.posted);

    this.RunMainThread();

    Assert.Single(this.posted);
  }

  /// <summary>
  /// A stack can write the profile path otherwise than the platform reports it.
  /// </summary>
  [Fact]
  public void ProfilePath_IsStrippedFromTheMessageAndTheStack_InBothSlashStylesAndAnyCase() {
    var reporter = this.CreateReporter(this.RecordingApi(), profilePath: @"C:\Users\Alice");

    reporter.ReportException(
      new TextException(
        @"System.IO.IOException: Sharing violation on C:\Users\Alice\AppData\LocalLow\file" +
        "\n  at HallOfFame.Thing.Read () in c:/users/ALICE/Documents/HallOfFame/Thing.cs:3 ",
        @"Sharing violation on C:\Users\Alice\AppData\LocalLow\file, in C:\\Users\\Alice\\x.json"
      ),
      ErrorSeverity.Silent
    );

    this.RunMainThread();

    var report = Assert.Single(this.posted);

    Assert.Equal(
      @"Sharing violation on %USERPROFILE%\AppData\LocalLow\file, in %USERPROFILE%\\x.json",
      report.Message
    );

    Assert.Equal(
      @"System.IO.IOException: Sharing violation on %USERPROFILE%\AppData\LocalLow\file" +
      "\n  at HallOfFame.Thing.Read () in %USERPROFILE%/Documents/HallOfFame/Thing.cs:3 ",
      report.Stack
    );
  }

  /// <summary>
  /// Another profile whose name starts like the player's is not the player's.
  /// </summary>
  [Fact]
  public void ProfilePath_LeavesAPathItOnlyPrefixes() {
    var reporter = this.CreateReporter(this.RecordingApi(), profilePath: @"C:\Users\Al");

    reporter.ReportException(new Exception(@"Missing C:\Users\Alice\file."), ErrorSeverity.Silent);

    this.RunMainThread();

    Assert.Equal(@"Missing C:\Users\Alice\file.", Assert.Single(this.posted).Message);
  }

  /// <summary>
  /// Under Proton the profile is Wine's, while a folder the player chose can sit in the Linux home.
  /// </summary>
  [Fact]
  public void LinuxHome_IsStrippedFromTheMessage_InBothSlashStyles() {
    var reporter = this.CreateReporter(this.RecordingApi(), profilePath: @"C:\users\steamuser");

    reporter.ReportException(
      new Exception(@"Denied on Z:\home\alice\Pictures\a.png, then on Z:/home/alice/b.png."),
      ErrorSeverity.Silent
    );

    this.RunMainThread();

    Assert.Equal(
      @"Denied on %USERPROFILE%\Pictures\a.png, then on %USERPROFILE%/b.png.",
      Assert.Single(this.posted).Message
    );
  }

  [Fact]
  public void ReportUIError_PostsTheStackAsTheUISentIt() {
    const string stack =
      "TypeError: Probe: thrown in the UI bundle at 1794814312482.\n" +
      "    at J2 (coui://ui-mods/HallOfFame.mjs:15:33308)\n" +
      "    at coui://ui-mods/HallOfFame.mjs:15:33420";

    this.reporter.ReportUIError(isFatal: true, stack);

    var body = this.SendAndReadSingleBody();

    Assert.Equal(
      ["context", "severity", "source", "stack"],
      body.Keys.OrderBy(key => key, StringComparer.Ordinal)
    );

    Assert.Equal("ui", (string) body["source"]);
    Assert.Equal("fatal", (string) body["severity"]);
    Assert.Equal(stack, (string) body["stack"]);
  }

  [Fact]
  public void ReportUIError_NotFatal_IsRecoverable_AsTheErrorDialogStillShows() {
    this.reporter.ReportUIError(isFatal: false, "TypeError: boom");

    Assert.Equal("recoverable", (string) this.SendAndReadSingleBody()["severity"]);
  }

  [Fact]
  public void ReportUIError_SameString_IsSentOnce_AndNothingIsSentForNone() {
    this.reporter.ReportUIError(isFatal: false, "TypeError: boom");
    this.reporter.ReportUIError(isFatal: true, "TypeError: boom");
    this.reporter.ReportUIError(isFatal: false, null);
    this.reporter.ReportUIError(isFatal: false, "");

    this.RunMainThread();

    Assert.Single(this.posted);
  }

  [Fact]
  public void ReportEscaped_PostsTheExceptionWithNoSeverity() {
    this.reporter.ReportEscaped("SceneFlow", ErrorReporterTests.Probe());

    var body = this.SendAndReadSingleBody();

    Assert.Equal(
      ["context", "message", "source", "stack", "type"],
      body.Keys.OrderBy(key => key, StringComparer.Ordinal)
    );

    Assert.Equal("escaped", (string) body["source"]);
    Assert.Equal(ErrorReporterTests.MonoExceptionText, (string) body["stack"]);
  }

  /// <summary>
  /// Every error call of the mod's log echoes through the game's log on the mod's logger, and was
  /// already heard there when it carried an exception.
  /// </summary>
  [Fact]
  public void ReportEscaped_FromTheModsLogger_IsLeftOut() {
    this.reporter.ReportEscaped("HallOfFame", ErrorReporterTests.Probe());
    this.reporter.ReportEscaped("SceneFlow", null);

    this.RunMainThread();

    Assert.Empty(this.posted);
  }

  /// <summary>
  /// Unity's own log, an <c>async void</c> method's exception, names no logger.
  /// </summary>
  [Fact]
  public void ReportEscaped_FromUnitysLog_IsKept() {
    this.reporter.ReportEscaped(null, ErrorReporterTests.Probe());

    this.RunMainThread();

    Assert.Single(this.posted);
  }

  [Fact]
  public void HoldsModFrame_ReadsTheFramesOfMonosText() {
    Assert.True(ErrorReporter.HoldsModFrame(ErrorReporterTests.MonoExceptionText));

    Assert.False(ErrorReporter.HoldsModFrame(ErrorReporterTests.NeverThrownExceptionText));

    Assert.False(
      ErrorReporter.HoldsModFrame(
        "System.NullReferenceException: Object reference not set to an instance of an object\r\n" +
        "  at Game.Simulation.Foo.OnUpdate () [0x00010] in <0123456789abcdef>:0 \r\n" +
        "  at Game.UpdateSystem.Update (Game.SystemUpdatePhase phase) [0x00030] in <0123>:0 "
      )
    );

    // Another mod named after this one is not this one.
    Assert.False(
      ErrorReporter.HoldsModFrame(
        "System.Exception: boom\r\n  at HallOfFameExtras.Thing.Do () [0x00001] in <0123>:0 "
      )
    );

    // The game's frames, then the mod's, deeper in: the mod's call broke the game's code.
    Assert.True(
      ErrorReporter.HoldsModFrame(
        "System.Exception: boom\r\n" +
        "  at Game.UI.Thing.Do () [0x00001] in <0123>:0 \r\n" +
        "  at HallOfFame.Systems.CommonUISystem.OnUpdate () [0x00001] in <0123>:0 "
      )
    );
  }

  [Fact]
  public void EntryPoints_NeverThrow_WhenTheirOwnWorkFails() {
    var reporter = this.CreateReporter(
      this.RecordingApi(),
      postToMainThread: _ => throw new InvalidOperationException("dispatcher broke")
    );

    reporter.ReportException(new InvalidOperationException(), ErrorSeverity.Silent);
    reporter.ReportException(new BrokenException(), ErrorSeverity.Silent);
    reporter.ReportEscaped("SceneFlow", new BrokenException());
    reporter.ReportUIError(isFatal: false, "TypeError: boom");
  }

  [Fact]
  public void FailedSend_RaisesNothing() {
    var reporter = this.CreateReporter(
      new FakeApi {
        PostErrorReportImpl = report => report.Message is "sync"
          ? throw new InvalidOperationException("thrown")
          : Task.FromException(new InvalidOperationException("faulted"))
      }
    );

    reporter.ReportException(new Exception("sync"), ErrorSeverity.Silent);
    reporter.ReportException(new Exception("async"), ErrorSeverity.Silent);

    this.RunMainThread();
  }

  /// <summary>
  /// The HTTP layer logs a failed send with its exception, which is not always an HTTP one, and the
  /// log hands it back to the reporter: in the send's own flow it is left out, before and after an
  /// await, while an error raised elsewhere at the same time still goes out.
  /// </summary>
  [Fact]
  public async Task FailureOfItsOwnSend_IsNeverReported() {
    ErrorReporter? reporter = null;
    var sendsOnTheirWay = new TaskCompletionSource<bool>();

    reporter = this.CreateReporter(
      new FakeApi {
        PostErrorReportImpl = async report => {
          this.posted.Add(report);

          // Set before the first report is sent.
          reporter!.ReportException(new Exception("logged before the await"), ErrorSeverity.Silent);

          await sendsOnTheirWay.Task;

          reporter.ReportException(new Exception("logged after the await"), ErrorSeverity.Silent);

          throw new InvalidOperationException("send failed");
        }
      }
    );

    reporter.ReportException(new Exception("the error"), ErrorSeverity.Silent);
    this.RunMainThread();

    // Raised outside the send while it is on its way.
    reporter.ReportException(new Exception("another error"), ErrorSeverity.Silent);

    sendsOnTheirWay.SetResult(true);

    // Lets the continuations after the await run, on the thread pool here.
    await Task.Delay(50, TestContext.Current.CancellationToken);

    this.RunMainThread();
    await Task.Delay(50, TestContext.Current.CancellationToken);
    this.RunMainThread();

    Assert.Equal(
      ["the error", "another error"],
      this.posted.Select(report => report.Message)
    );
  }

  /// <summary>
  /// Throws <paramref name="create"/>'s exception and returns it caught, so it carries a stack.
  /// </summary>
  private static Exception Thrown(Func<Exception> create) {
    try {
      throw create();
    }
    catch (Exception ex) {
      return ex;
    }
  }

  /// <summary>
  /// The exception whose text is <see cref="MonoExceptionText"/>.
  /// </summary>
  private static Exception Probe() => new TextException(ErrorReporterTests.MonoExceptionText);

  private static Exception ThrowFromTheSameSite(string message) =>
    ErrorReporterTests.Thrown(() => new InvalidOperationException(message));

  private ErrorReporter CreateReporter(
    FakeApi api,
    ErrorContext? context = null,
    string profilePath = "",
    Action<Action>? postToMainThread = null
  ) =>
    new(
      api,
      this.settings,
      context ?? ErrorReporterTests.Context,
      postToMainThread ?? this.mainThread.Add
    ) {
      ProfilePath = profilePath
    };

  private FakeApi RecordingApi() =>
    new() {
      PostErrorReportImpl = report => {
        this.posted.Add(report);

        return Task.CompletedTask;
      }
    };

  /// <summary>
  /// Reports an undecodable response where it is caught, then rethrows it, as
  /// <c>HttpQueries.ParseResponse</c> does.
  /// </summary>
  [MethodImpl(MethodImplOptions.NoInlining)]
  private void ReportAndRethrow() {
    try {
      throw new HttpNetworkException("1", "Failed to parse JSON response") {
        IsUndecodable = true
      };
    }
    catch (Exception ex) {
      this.reporter.ReportException(ex, ErrorSeverity.Silent);

      throw;
    }
  }

  /// <summary>
  /// Runs what the reporter posted to the main thread, as the game's update does at its next frame.
  /// </summary>
  private void RunMainThread() {
    var actions = this.mainThread.ToList();

    this.mainThread.Clear();

    actions.ForEach(action => action());
  }

  private ProxyObject SendAndReadSingleBody() {
    this.RunMainThread();

    return (ProxyObject) JSON.Load(JSON.Dump(Assert.Single(this.posted).ToRequestBody()));
  }

  /// <summary>
  /// An exception whose text is set by the test, as a stack captured in the running game.
  /// </summary>
  private sealed class TextException(string text, string message = "Probe") : Exception(message) {
    public override string StackTrace => text;

    public override string ToString() => text;
  }

  /// <summary>
  /// An exception whose stack is past the server's bound.
  /// </summary>
  private sealed class LongStackException(string message) : Exception(message) {
    public override string StackTrace => new('s', 20000);

    public override string ToString() => this.StackTrace;
  }

  /// <summary>
  /// An exception whose text throws, as a custom exception's can.
  /// </summary>
  private sealed class BrokenException : Exception {
    public override string StackTrace => throw new InvalidOperationException("no stack");

    public override string ToString() => throw new InvalidOperationException("no text");
  }
}
