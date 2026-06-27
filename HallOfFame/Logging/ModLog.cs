using System;
using Colossal.Logging;
using HallOfFame.Utils;

namespace HallOfFame.Logging;

/// <summary>
/// Production <see cref="IModLog"/> that forwards to the game's <see cref="ILog"/>.
/// It owns the small amount of behavior that used to live in logging extension methods: the
/// "silent" toggle of <see cref="ILog.showsErrorsInUI"/>, and building the user-facing
/// recoverable/fatal error messages from the localization dictionary.
/// </summary>
internal sealed class ModLog(ILog log) : IModLog {
  public void Verbose(string message) =>
    log.Verbose(message);

  public void Info(string message) =>
    log.Info(message);

  public void Warn(string message) =>
    log.Warn(message);

  public void Warn(Exception exception, string message) =>
    log.Warn(exception, message);

  public void Error(string message) =>
    log.Error(message);

  public void ErrorSilent(string message) =>
    this.Silently(() => log.Error(message));

  public void ErrorSilent(Exception exception) =>
    this.Silently(() => log.Error(exception));

  public void ErrorSilent(Exception exception, string message) =>
    this.Silently(() => log.Error(exception, message));

  public void ErrorRecoverable(Exception exception) {
    var @base = "HallOfFame.Common.BASE_ERROR".Translate();
    var gravity = "HallOfFame.Common.RECOVERABLE_ERROR".Translate();

    log.Error(exception, $"{@base} \n{gravity}");
  }

  public void ErrorFatal(Exception exception) {
    var @base = "HallOfFame.Common.BASE_ERROR".Translate();
    var gravity = "HallOfFame.Common.FATAL_ERROR".Translate();

    log.Error(exception, $"{@base} \n{gravity}");
  }

  /// <summary>
  /// Runs <paramref name="logError"/> with the underlying logger's "show errors in UI" flag
  /// temporarily disabled, then restores it, so the error is logged but not surfaced to the user.
  /// </summary>
  private void Silently(Action logError) {
    var previousShowsErrorsInUI = log.showsErrorsInUI;
    log.showsErrorsInUI = false;

    logError();

    log.showsErrorsInUI = previousShowsErrorsInUI;
  }
}
