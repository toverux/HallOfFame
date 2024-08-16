using System;
using Colossal.Logging;

namespace HallOfFame.Utils;

internal static class LogExtensions {
    /// <summary>
    /// Logs an unexpected but probably recoverable exception.
    /// As we set <see cref="ILog.showsErrorsInUI"/> to true this will be shown
    /// to the user.
    /// We warn them that they can probably safely continue to play.
    /// </summary>
    internal static void ErrorRecoverable(this ILog log, Exception ex) {
        var @base = "HallOfFame.Common.BASE_ERROR".Translate();
        var gravity = "HallOfFame.Common.RECOVERABLE_ERROR".Translate();

        log.Error(ex, $"{@base} \n{gravity}");
    }

    /// <summary>
    /// Same as <see cref="ErrorRecoverable"/> but for fatal errors, i.e. errors
    /// that we don't know what side effects they might have.
    /// </summary>
    internal static void ErrorFatal(this ILog log, Exception ex) {
        var @base = "HallOfFame.Common.BASE_ERROR".Translate();
        var gravity = "HallOfFame.Common.FATAL_ERROR".Translate();

        log.Error(ex, $"{@base} \n{gravity}");
    }

    /// <summary>
    /// Logs an error but does not show it to the user regardless of the logger
    /// <see cref="ILog.showsErrorsInUI"/> configuration.
    /// </summary>
    internal static void ErrorSilent(this ILog log, Exception ex) {
        var prevShowsErrorsInUI = log.showsErrorsInUI;
        log.showsErrorsInUI = false;

        log.Error(ex);

        log.showsErrorsInUI = prevShowsErrorsInUI;
    }

    /// <inheritdoc cref="ErrorSilent(ILog,Exception)"/>
    internal static void ErrorSilent(
        this ILog log,
        object message) {
        var prevShowsErrorsInUI = log.showsErrorsInUI;
        log.showsErrorsInUI = false;

        log.Error(message);

        log.showsErrorsInUI = prevShowsErrorsInUI;
    }

    /// <inheritdoc cref="ErrorSilent(ILog,Exception)"/>
    internal static void ErrorSilent(
        this ILog log,
        Exception ex,
        object message) {
        var prevShowsErrorsInUI = log.showsErrorsInUI;
        log.showsErrorsInUI = false;

        log.Error(ex, message);

        log.showsErrorsInUI = prevShowsErrorsInUI;
    }
}
