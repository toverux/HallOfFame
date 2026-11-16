namespace HallOfFame.Services;

/// <summary>
/// Narrow seam over the one <see cref="Settings"/> value <see cref="UsageTracker"/> and
/// <see cref="ErrorReporter"/> read, so both construct and run off-engine under test, like
/// <see cref="IMenuTourStore"/>.
/// </summary>
internal interface IUsageSettings {
  /// <summary>
  /// Whether the player lets the mod send usage statistics: the usage events, the session header,
  /// and the error reports.
  /// Read at each call, so turning it off stops all three at once.
  /// </summary>
  bool SendUsageStatistics { get; }
}
