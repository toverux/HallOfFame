using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using HallOfFame.Http;
using HallOfFame.Logging;

namespace HallOfFame.Services;

/// <summary>
/// Sends the mod's unforeseen errors to the server, which passes them to Sentry, while the player
/// allows usage statistics.
/// <para>
/// Three entry points take an error: <see cref="ReportException"/> from the log's error calls,
/// <see cref="ReportUIError"/> from the UI, and <see cref="ReportEscaped"/> from the game's log,
/// for an exception of the mod no catch of its own saw.
/// Each runs on any thread and decides at once whether the error goes out, so a report counts as
/// sent when it is queued; the request then leaves from the main thread, where the HTTP layer runs.
/// </para>
/// <para>
/// Reporting costs the player nothing: no entry point ever throws, the reporter never logs an
/// error, and a failure of its own send is neither logged by it nor reported.
/// </para>
/// </summary>
/// <param name="api">Server API the reports are posted to.</param>
/// <param name="settings">
/// Narrow seam over the player's toggle, read at each report and again as it is sent.
/// </param>
/// <param name="context">The machine and the build, read once at startup.</param>
/// <param name="postToMainThread">
/// Runs an action on the main thread at a later frame, whatever thread posts it.
/// It must depend on no mod system, as a system that fails to create reports through here.
/// </param>
internal sealed class ErrorReporter(
  IHallOfFameApi api,
  IUsageSettings settings,
  ErrorContext context,
  Action<Action> postToMainThread
) {
  /// <summary>
  /// The reports a session sends at most, every source counted together, so a game update that
  /// breaks the mod does not flood the player's connection or the server.
  /// </summary>
  internal const int MaxReportsPerSession = 10;

  /// <summary>
  /// The name of the mod's logger, whose entries the game's log hook sees again: each already went
  /// through <see cref="ReportException"/> when it carried an exception.
  /// </summary>
  private const string ModLoggerName = nameof(HallOfFame);

  /// <summary>
  /// What a profile path is replaced with in a report.
  /// </summary>
  private const string ProfilePathReplacement = "%USERPROFILE%";

  /// <summary>
  /// A frame of the mod's own code, in Mono's text of an exception.
  /// </summary>
  private static readonly Regex ModFrameRegex = new(
    @"^\s*at HallOfFame\.",
    RegexOptions.Multiline | RegexOptions.CultureInvariant
  );

  /// <summary>
  /// A path through a Linux home as Wine shows it, ex. <c>Z:\home\name</c>: under Proton the
  /// profile path is Wine's and names no one, while a folder the player chose can sit in their
  /// Linux home.
  /// A path without a drive is left, as a stack frame's source path is the build machine's.
  /// </summary>
  private static readonly Regex LinuxHomeRegex = new(
    @"\b[A-Za-z]:[\\/]+home[\\/]+[^\\/\s]+",
    RegexOptions.IgnoreCase | RegexOptions.CultureInvariant
  );

  /// <summary>
  /// The identity of each error sent this session, which also counts the reports sent.
  /// Locked on, as the entry points run on any thread.
  /// </summary>
  private readonly HashSet<string> sentErrors = [];

  /// <summary>
  /// Each exception sent this session: one logged where it is caught, then rethrown and logged
  /// again by a caller, is the same error, though its stack grew.
  /// Weak, so it keeps no exception alive.
  /// </summary>
  private readonly ConditionalWeakTable<Exception, string> sentExceptions = [];

  /// <summary>
  /// Set in the async flow of the reporter's own send, and only there: an error the HTTP layer logs
  /// while it sends is then left out, whatever exception it logs it with.
  /// </summary>
  private readonly AsyncLocal<bool> isSending = new();

  /// <summary>
  /// The player's profile folder, ex. <c>C:\Users\Name</c>, stripped from every message and stack,
  /// as it names the player.
  /// Empty when it could not be read, and nothing is stripped then.
  /// </summary>
  internal string ProfilePath { get; init; } = "";

  /// <summary>
  /// Whether the reporter takes errors at all.
  /// Off by default in Debug builds, so development errors stay out of the project: a Debug entry
  /// point turns it on.
  /// </summary>
  internal bool IsEnabled { get; set; } = true;

  /// <summary>
  /// Whether a report would go out now, before the cost of its text: the reporter is on, the player
  /// allows it, the session has reports left, and this is not the reporter's own send.
  /// </summary>
  private bool IsAccepting {
    get {
      if (!this.IsEnabled || !settings.SendUsageStatistics || this.isSending.Value) {
        return false;
      }

      lock (this.sentErrors) {
        return this.sentErrors.Count < ErrorReporter.MaxReportsPerSession;
      }
    }
  }

  /// <summary>
  /// Takes an exception from one of the log's error calls.
  /// An <see cref="HttpException"/> is a foreseen failure the server or the network already
  /// explains, and is left out, except for a response the mod could not decode, a wire format
  /// mismatch.
  /// </summary>
  internal void ReportException(Exception exception, ErrorSeverity severity) {
    try {
      if (exception is HttpException and not HttpNetworkException { IsUndecodable: true }) {
        return;
      }

      this.ReportThrown(ErrorSource.Log, severity, exception);
    }
    catch {
      // Reporting never raises, see the class docblock.
    }
  }

  /// <summary>
  /// Takes an exception the game's log saw, from any logger: kept when it went through a frame of
  /// the mod, and when it was not logged by the mod's own logger, which
  /// <see cref="ReportException"/> already heard.
  /// </summary>
  /// <param name="loggerName">The logger it was logged on, <c>null</c> for Unity's own.</param>
  /// <param name="exception">The exception logged, <c>null</c> for a message-only entry.</param>
  internal void ReportEscaped(string? loggerName, Exception? exception) {
    try {
      if (exception is null || loggerName is ErrorReporter.ModLoggerName || !this.IsAccepting) {
        return;
      }

      var text = exception.ToString();

      if (ErrorReporter.HoldsModFrame(text)) {
        this.ReportThrown(ErrorSource.Escaped, severity: null, exception, text);
      }
    }
    catch {
      // Reporting never raises, see the class docblock.
    }
  }

  /// <summary>
  /// Takes an error the UI sent, its stack as the UI wrote it, minified.
  /// The UI's fatal flag picks the severity, as C# shows the error dialog either way.
  /// </summary>
  internal void ReportUIError(bool isFatal, string? error) {
    try {
      if (error is null || string.IsNullOrWhiteSpace(error) || !this.IsAccepting) {
        return;
      }

      // The string stands for both the type and the stack, the UI sending nothing else.
      if (!this.TryClaim($"{ErrorSource.UI}\n{error}")) {
        return;
      }

      this.Queue(
        new ErrorReport {
          Source = ErrorSource.UI,
          Severity = isFatal ? ErrorSeverity.Fatal : ErrorSeverity.Recoverable,
          Stack = this.StripProfilePath(error),
          Context = context
        }
      );
    }
    catch {
      // Reporting never raises, see the class docblock.
    }
  }

  /// <summary>
  /// Whether Mono's text of an exception holds a frame of the mod's own code, its inner exceptions'
  /// included.
  /// </summary>
  internal static bool HoldsModFrame(string exceptionText) =>
    ErrorReporter.ModFrameRegex.IsMatch(exceptionText);

  private void ReportThrown(
    ErrorSource source,
    ErrorSeverity? severity,
    Exception exception,
    string? text = null
  ) {
    if (
      !this.IsAccepting ||
      !this.TryClaim(ErrorReporter.Identify(source, exception), exception)) {
      return;
    }

    this.Queue(
      new ErrorReport {
        Source = source,
        Severity = severity,
        Type = exception.GetType().FullName,
        Message = this.StripProfilePath(exception.Message),
        Stack = this.StripProfilePath(text ?? exception.ToString()),
        Context = context
      }
    );
  }

  /// <summary>
  /// What makes two exceptions the same error: their source, then the type and stack of each
  /// exception of the chain.
  /// The message is left out, as it often carries an ID or a path, except where an exception has no
  /// stack, as one built and never thrown: there it stands in for the stack, so that each such
  /// error still counts as its own.
  /// </summary>
  private static string Identify(ErrorSource source, Exception exception) {
    var parts = new List<string> {
      source.ToString()
    };

    for (var current = exception; current is not null; current = current.InnerException) {
      parts.Add(current.GetType().FullName);
      parts.Add(current.StackTrace ?? current.Message);
    }

    return string.Join("\n", parts);
  }

  /// <summary>
  /// Claims a report for an error not sent yet this session, while the session has reports left.
  /// </summary>
  /// <param name="identity">The error's identity.</param>
  /// <param name="exception">The exception the error is, <c>null</c> for a UI error.</param>
  private bool TryClaim(string identity, Exception? exception = null) {
    lock (this.sentErrors) {
      if (
        this.sentErrors.Count >= ErrorReporter.MaxReportsPerSession ||
        (exception is not null && this.sentExceptions.TryGetValue(exception, out _)) ||
        !this.sentErrors.Add(identity)) {
        return false;
      }

      if (exception is not null) {
        this.sentExceptions.Add(exception, identity);
      }

      return true;
    }
  }

  private void Queue(ErrorReport report) => postToMainThread(() => _ = this.Send(report));

  /// <summary>
  /// Posts a report, unless the player turned usage statistics off since it was queued.
  /// Never throws, so the main thread can fire and forget it.
  /// </summary>
  private async Task Send(ErrorReport report) {
    try {
      if (!settings.SendUsageStatistics) {
        return;
      }

      // Scoped to this method's flow: the runtime restores the caller's value when it returns.
      this.isSending.Value = true;

      await api.PostErrorReport(report);
    }
    catch {
      // A failed report is lost: reporting it would report the reporter, and a server without the
      // route, an older one, answers 404, which ends here as well.
    }
  }

  /// <summary>
  /// Replaces the player's profile path in <paramref name="text"/>, in either slash style, a JSON
  /// escape's doubled backslash included, and whatever its case, as a stack can write it otherwise
  /// than the platform reports it.
  /// </summary>
  private string StripProfilePath(string text) {
    var stripped = ErrorReporter.LinuxHomeRegex.Replace(text, ErrorReporter.ProfilePathReplacement);

    var segments = this.ProfilePath.Split(['\\', '/'], StringSplitOptions.RemoveEmptyEntries);

    // A drive alone would strip every path of the report.
    if (segments.Length < 2) {
      return stripped;
    }

    // Not followed by what could continue the last segment, so C:\Users\Al leaves C:\Users\Alice.
    var pattern = string.Join(@"[\\/]+", segments.Select(Regex.Escape)) + @"(?![\w.-])";

    return Regex.Replace(
      stripped,
      pattern,
      ErrorReporter.ProfilePathReplacement,
      RegexOptions.IgnoreCase | RegexOptions.CultureInvariant
    );
  }
}
