namespace HallOfFame.Reflection;

/// <summary>
/// Seam over the Paradox login touchpoint used by <see cref="Services.CreatorIdentity"/>: reading
/// the account ID and warning the user when they are not connected.
/// Both operations are the same engine and reflection surface, kept behind this interface so the
/// identity module stays unit-testable off-engine.
/// The production implementation is <see cref="ParadoxConnection"/>; tests inject a fake.
/// </summary>
internal interface IParadoxConnection {
  /// <summary>
  /// Reads the Paradox account ID of the user, or <c>null</c> when they are not logged in.
  /// Throws when the read itself fails, which the caller keeps distinct from a clean <c>null</c>.
  /// </summary>
  string? ReadAccountId();

  /// <summary>
  /// Shows a warning dialog telling the user they are not using their Paradox account ID.
  /// </summary>
  void ShowNoParadoxConnectionWarning();
}
