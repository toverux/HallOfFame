using System;
using System.Collections.Generic;
using HallOfFame.Logging;
using Xunit;

namespace HallOfFame.Tests.Logging;

public sealed class ModLogTests {
  private readonly RecordingLog recorder;

  private readonly List<(Exception Exception, ErrorSeverity Severity)> reported = [];

  private readonly ModLog modLog;

  public ModLogTests() {
    (var log, this.recorder) = RecordingLog.Create();

    this.modLog = new ModLog(
      log,
      static key => $"<{key}>",
      (exception, severity) => this.reported.Add((exception, severity))
    );
  }

  [Fact]
  public void PlainLevels_ForwardToTheSameLevel() {
    this.modLog.Verbose("v");
    this.modLog.Info("i");
    this.modLog.Warn("w");
    this.modLog.Error("e");

    Assert.Equal(
      [("Verbose", "v"), ("Info", "i"), ("Warn", "w"), ("Error", "e")],
      this.recorder.Calls.ConvertAll(static call => (call.Method, call.Args[0]))
    );
  }

  [Fact]
  public void ErrorSilent_LogsAnErrorHiddenFromThePlayer() {
    this.modLog.ErrorSilent("boom");

    var call = Assert.Single(this.recorder.Calls);

    Assert.Equal("Error", call.Method);
    Assert.False(call.ShowsErrorsInUI);
  }

  [Theory]
  [InlineData(true)]
  [InlineData(false)]
  public void ErrorSilent_RestoresTheShowsErrorsInUIFlag(bool showsErrorsInUI) {
    this.recorder.ShowsErrorsInUI = showsErrorsInUI;

    this.modLog.ErrorSilent(new InvalidOperationException());

    Assert.Equal(showsErrorsInUI, this.recorder.ShowsErrorsInUI);
  }

  [Fact]
  public void ErrorRecoverable_ShowsTheRecoverableMessageWithTheException() {
    var exception = new InvalidOperationException();

    this.modLog.ErrorRecoverable(exception);

    var call = Assert.Single(this.recorder.Calls);

    Assert.Equal("Error", call.Method);
    Assert.True(call.ShowsErrorsInUI);
    Assert.Same(exception, call.Args[0]);

    Assert.Equal(
      $"<{ModLog.BaseErrorKey}> \n<{ModLog.RecoverableErrorKey}>",
      call.Args[1]
    );
  }

  [Fact]
  public void ErrorFatal_ShowsTheFatalMessageWithTheException() {
    var exception = new InvalidOperationException();

    this.modLog.ErrorFatal(exception);

    var call = Assert.Single(this.recorder.Calls);

    Assert.Equal("Error", call.Method);
    Assert.True(call.ShowsErrorsInUI);
    Assert.Same(exception, call.Args[0]);
    Assert.Equal($"<{ModLog.BaseErrorKey}> \n<{ModLog.FatalErrorKey}>", call.Args[1]);
  }

  [Fact]
  public void ErrorCalls_CarryingAnException_ReachTheReporter_WithTheirSeverity() {
    var silent = new InvalidOperationException("silent");
    var silentWithMessage = new InvalidOperationException("silent with message");
    var recoverable = new InvalidOperationException("recoverable");
    var fatal = new InvalidOperationException("fatal");

    this.modLog.ErrorSilent(silent);
    this.modLog.ErrorSilent(silentWithMessage, "message");
    this.modLog.ErrorRecoverable(recoverable);
    this.modLog.ErrorFatal(fatal);

    Assert.Equal(
      [
        (silent, ErrorSeverity.Silent),
        (silentWithMessage, ErrorSeverity.Silent),
        (recoverable, ErrorSeverity.Recoverable),
        (fatal, ErrorSeverity.Fatal)
      ],
      this.reported
    );
  }

  /// <summary>
  /// A message-only call is most often the HTTP layer's log line, a foreseen failure, and a warning
  /// is not an error, so neither is reported.
  /// </summary>
  [Fact]
  public void MessageOnlyCallsAndWarnings_DoNotReachTheReporter() {
    this.modLog.Error("error");
    this.modLog.ErrorSilent("silent");
    this.modLog.Warn(new InvalidOperationException(), "warning");

    Assert.Empty(this.reported);
  }
}
