namespace HallOfFame.Logging;

/// <summary>
/// How bad an error the mod logs is, by the <see cref="IModLog"/> method it went through.
/// </summary>
internal enum ErrorSeverity {
  /// <summary>
  /// <see cref="IModLog.ErrorSilent(System.Exception)"/>: background work the player never sees
  /// fail.
  /// </summary>
  Silent,

  /// <summary>
  /// <see cref="IModLog.ErrorRecoverable"/>: shown to the player, who can probably play on.
  /// </summary>
  Recoverable,

  /// <summary>
  /// <see cref="IModLog.ErrorFatal"/>: shown to the player, its side effects unknown.
  /// </summary>
  Fatal
}
