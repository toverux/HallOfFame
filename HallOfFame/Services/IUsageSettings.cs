namespace HallOfFame.Services;

/// <summary>
/// Narrow seam over the one <see cref="Settings"/> value <see cref="UsageTracker"/> reads, so the
/// tracker constructs and runs off-engine under test, like <see cref="IMenuTourStore"/>.
/// </summary>
internal interface IUsageSettings {
  /// <summary>
  /// Whether the player lets the mod send usage statistics: the usage events and the session
  /// header.
  /// Read at each call, so turning it off stops both at once.
  /// </summary>
  bool SendUsageStatistics { get; }
}
