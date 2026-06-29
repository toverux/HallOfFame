using System;
using Game.UI.Localization;

namespace HallOfFame.Logging;

/// <summary>
/// Mod-owned logging seam over the game's <c>Colossal.Logging.ILog</c>.
/// It exposes only the operations the mod actually uses, typed in mod terms (plain strings and
/// exceptions), so logging-dependent logic can be unit-tested off-engine against a fake instead of
/// the engine-bound <c>ILog</c>, which cannot load on the net48 test runtime.
/// The production implementation is <see cref="ModLog"/>; tests inject a fake.
/// </summary>
internal interface IModLog {
  /// <summary>
  /// Logs a verbose, developer-oriented diagnostic message.
  /// </summary>
  void Verbose(string message);

  /// <summary>
  /// Logs an informational message.
  /// </summary>
  void Info(string message);

  /// <summary>
  /// Logs a warning message.
  /// </summary>
  void Warn(string message);

  /// <summary>
  /// Logs a warning message together with the exception that prompted it.
  /// </summary>
  void Warn(Exception exception, string message);

  /// <summary>
  /// Logs an error message also surfaced to the user in the game UI.
  /// </summary>
  void Error(string message);

  /// <summary>
  /// Same as <see cref="Error(string)"/> but takes a <see cref="LocalizedString"/> that the
  /// implementation renders to display text.
  /// This keeps the (engine-bound) rendering inside the production logger, so a caller that owns a
  /// user-friendly <see cref="LocalizedString"/> can log it without rendering off-engine itself.
  /// </summary>
  void Error(LocalizedString message);

  /// <summary>
  /// Logs an error message without surfacing it to the user, regardless of the underlying logger's
  /// "show errors in UI" configuration.
  /// </summary>
  void ErrorSilent(string message);

  /// <inheritdoc cref="ErrorSilent(string)"/>
  void ErrorSilent(Exception exception);

  /// <inheritdoc cref="ErrorSilent(string)"/>
  void ErrorSilent(Exception exception, string message);

  /// <summary>
  /// Logs an unexpected but probably recoverable exception.
  /// It is surfaced to the user with a message warning them that they can probably safely continue
  /// to play.
  /// </summary>
  void ErrorRecoverable(Exception exception);

  /// <summary>
  /// Same as <see cref="ErrorRecoverable"/> but for fatal errors, i.e., errors whose side effects
  /// are unknown.
  /// </summary>
  void ErrorFatal(Exception exception);
}
