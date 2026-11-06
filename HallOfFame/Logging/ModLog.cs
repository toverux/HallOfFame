using System;
using Colossal.Logging;

namespace HallOfFame.Logging;

/// <summary>
/// Production <see cref="IModLog"/> that forwards to the game's <see cref="ILog"/>.
/// It owns the "silent" toggle of <see cref="ILog.showsErrorsInUI"/>, and builds the user-facing
/// recoverable/fatal error messages from the localization dictionary through
/// <paramref name="translate"/>, the active dictionary's lookup in production.
/// </summary>
internal sealed class ModLog(ILog log, Func<string, string> translate) : IModLog {
  internal const string BaseErrorKey = $"{nameof(HallOfFame)}.Common.BASE_ERROR";

  internal const string RecoverableErrorKey =
    $"{nameof(HallOfFame)}.Common.RECOVERABLE_ERROR";

  internal const string FatalErrorKey = $"{nameof(HallOfFame)}.Common.FATAL_ERROR";

  public void Verbose(string message) => log.Verbose(message);

  public void Info(string message) => log.Info(message);

  public void Warn(string message) => log.Warn(message);

  public void Warn(Exception exception, string message) => log.Warn(exception, message);

  public void Error(string message) => log.Error(message);

  public void ErrorSilent(string message) => this.Silently(() => log.Error(message));

  public void ErrorSilent(Exception exception) => this.Silently(() => log.Error(exception));

  public void ErrorSilent(Exception exception, string message) =>
    this.Silently(() => log.Error(exception, message));

  public void ErrorRecoverable(Exception exception) =>
    log.Error(exception, ModLog.PlayerMessage(isFatal: false, translate));

  public void ErrorFatal(Exception exception) =>
    log.Error(exception, ModLog.PlayerMessage(isFatal: true, translate));

  /// <summary>
  /// The message shown to the player over an error: what happened, then how bad it is.
  /// </summary>
  internal static string PlayerMessage(bool isFatal, Func<string, string> translate) {
    var gravityKey = isFatal ? ModLog.FatalErrorKey : ModLog.RecoverableErrorKey;

    return $"{translate(ModLog.BaseErrorKey)} \n{translate(gravityKey)}";
  }

  /// <summary>
  /// Runs <paramref name="logError"/> with the underlying logger's "show errors in UI" flag
  /// temporarily disabled, then restores it, so the error is logged but not surfaced to the user.
  /// </summary>
  private void Silently(Action logError) {
    var previousShowsErrorsInUI = log.showsErrorsInUI;
    log.showsErrorsInUI = false;

    try {
      logError();
    }
    finally {
      log.showsErrorsInUI = previousShowsErrorsInUI;
    }
  }
}
