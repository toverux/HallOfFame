using System;
using System.Collections.Generic;
using HallOfFame.Logging;

namespace HallOfFame.Services;

/// <summary>
/// Where an error the mod reports was seen.
/// </summary>
internal enum ErrorSource {
  /// <summary>
  /// An error call of <see cref="IModLog"/> carrying an exception.
  /// </summary>
  Log,

  /// <summary>
  /// An exception of the mod that escaped to the game, which logged it.
  /// </summary>
  Escaped,

  /// <summary>
  /// An error the UI sent to C# through its <c>logJavaScriptError</c> trigger.
  /// </summary>
  UI
}

/// <summary>
/// The machine and the build an error report comes from, read once at startup.
/// Each value the mod failed to read is <c>null</c>, and left out of the report.
/// </summary>
internal sealed record ErrorContext {
  /// <summary>
  /// The mod's version, in the <c>1.2.3</c> form.
  /// </summary>
  public required string ModVersion { get; init; }

  /// <summary>
  /// The game's short version, in the <c>1.6.4f1</c> form.
  /// </summary>
  public required string GameVersion { get; init; }

  /// <summary>
  /// Whether the mod is a debug build.
  /// </summary>
  public required bool IsDebug { get; init; }

  /// <summary>
  /// The operating system, as Unity names it.
  /// </summary>
  public string? Platform { get; init; }

  /// <summary>
  /// Whether the game runs under Wine, Proton included.
  /// </summary>
  public bool? IsWine { get; init; }

  public int? ScreenWidth { get; init; }

  public int? ScreenHeight { get; init; }

  public string? GpuName { get; init; }

  public string? GpuVendor { get; init; }

  public string? GpuDriverVersion { get; init; }

  /// <summary>
  /// The game's active locale, ex. <c>en-US</c>.
  /// </summary>
  public string? Locale { get; init; }
}

/// <summary>
/// One error as the mod sends it to the server, which passes it to Sentry.
/// </summary>
internal sealed record ErrorReport {
  /// <summary>
  /// The bounds of the server's schema, in UTF-16 code units, as JavaScript counts a string's
  /// length.
  /// A report is cut to them, as the server refuses a report over one whole.
  /// </summary>
  internal const int MaxTypeLength = 256;

  /// <inheritdoc cref="MaxTypeLength"/>
  internal const int MaxMessageLength = 4096;

  /// <inheritdoc cref="MaxTypeLength"/>
  internal const int MaxStackLength = 16384;

  /// <inheritdoc cref="MaxTypeLength"/>
  internal const int MaxVersionLength = 32;

  /// <inheritdoc cref="MaxTypeLength"/>
  internal const int MaxContextTextLength = 128;

  /// <inheritdoc cref="MaxTypeLength"/>
  internal const int MaxLocaleLength = 16;

  /// <inheritdoc cref="MaxTypeLength"/>
  internal const int MaxScreenSize = 32768;

  public required ErrorSource Source { get; init; }

  /// <summary>
  /// The log method the error went through, <c>null</c> for an escaped exception.
  /// </summary>
  public ErrorSeverity? Severity { get; init; }

  /// <summary>
  /// The exception's full type name, <c>null</c> for a UI error, whose type is in its stack.
  /// </summary>
  public string? Type { get; init; }

  /// <summary>
  /// The exception's message, <c>null</c> for a UI error, whose message is in its stack.
  /// </summary>
  public string? Message { get; init; }

  /// <summary>
  /// The error as the runtime wrote it: Mono's <c>Exception.ToString()</c>, inner exceptions
  /// included, or the UI's <c>error.stack</c>.
  /// The server parses it into frames.
  /// </summary>
  public required string Stack { get; init; }

  public required ErrorContext Context { get; init; }

  /// <summary>
  /// The request body, which the server validates strictly: an unknown field, or a known one out of
  /// its bounds, refuses the whole report.
  /// Absent values are left out rather than sent as <c>null</c>, which the schema refuses.
  /// </summary>
  internal Dictionary<string, object> ToRequestBody() {
    var body = new Dictionary<string, object> {
      ["source"] = this.Source switch {
        ErrorSource.Log => "log",
        ErrorSource.Escaped => "escaped",
        ErrorSource.UI => "ui",
        _ => throw new InvalidOperationException($"Unknown source {this.Source}.")
      },
      ["stack"] = ErrorReport.Truncate(this.Stack, ErrorReport.MaxStackLength),
      ["context"] = ErrorReport.ToRequestContext(this.Context)
    };

    if (this.Severity is {} severity) {
      body["severity"] = severity switch {
        ErrorSeverity.Silent => "silent",
        ErrorSeverity.Recoverable => "recoverable",
        ErrorSeverity.Fatal => "fatal",
        _ => throw new InvalidOperationException($"Unknown severity {severity}.")
      };
    }

    ErrorReport.AddText(body, "type", this.Type, ErrorReport.MaxTypeLength);

    // The schema takes an empty message, an exception thrown with none.
    if (this.Message is not null) {
      body["message"] = ErrorReport.Truncate(this.Message, ErrorReport.MaxMessageLength);
    }

    return body;
  }

  private static Dictionary<string, object> ToRequestContext(ErrorContext context) {
    var body = new Dictionary<string, object> {
      ["modVersion"] = ErrorReport.Truncate(context.ModVersion, ErrorReport.MaxVersionLength),
      ["gameVersion"] = ErrorReport.Truncate(context.GameVersion, ErrorReport.MaxVersionLength),
      ["debug"] = context.IsDebug
    };

    ErrorReport.AddText(body, "platform", context.Platform, ErrorReport.MaxContextTextLength);

    if (context.IsWine is {} isWine) {
      body["wine"] = isWine;
    }

    ErrorReport.AddScreenSize(body, "screenWidth", context.ScreenWidth);
    ErrorReport.AddScreenSize(body, "screenHeight", context.ScreenHeight);

    ErrorReport.AddText(body, "gpuName", context.GpuName, ErrorReport.MaxContextTextLength);
    ErrorReport.AddText(body, "gpuVendor", context.GpuVendor, ErrorReport.MaxContextTextLength);

    ErrorReport.AddText(
      body,
      "gpuDriverVersion",
      context.GpuDriverVersion,
      ErrorReport.MaxContextTextLength
    );

    ErrorReport.AddText(body, "locale", context.Locale, ErrorReport.MaxLocaleLength);

    return body;
  }

  /// <summary>
  /// Adds a text field the schema wants non-empty, left out when there is nothing to send.
  /// </summary>
  private static void AddText(
    Dictionary<string, object> body,
    string key,
    string? value,
    int maxLength
  ) {
    if (value is {} text && !string.IsNullOrWhiteSpace(text)) {
      body[key] = ErrorReport.Truncate(text, maxLength);
    }
  }

  private static void AddScreenSize(Dictionary<string, object> body, string key, int? value) {
    if (value is >= 1 and <= ErrorReport.MaxScreenSize) {
      body[key] = value.Value;
    }
  }

  /// <summary>
  /// Cuts <paramref name="text"/> to <paramref name="maxLength"/> code units, never between the two
  /// halves of a surrogate pair, which would leave half a character for the JSON encoder.
  /// </summary>
  private static string Truncate(string text, int maxLength) {
    if (text.Length <= maxLength) {
      return text;
    }

    var length = char.IsHighSurrogate(text[maxLength - 1]) ? maxLength - 1 : maxLength;

    return text[..length];
  }
}
