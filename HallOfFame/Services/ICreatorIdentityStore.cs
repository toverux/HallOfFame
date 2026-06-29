using Game.UI.Localization;

namespace HallOfFame.Services;

/// <summary>
/// Narrow seam over the persisted and UI-bound creator identity state that lives on
/// <see cref="Settings"/>.
/// The state has to stay on <see cref="Settings"/> because the modding framework deserializes and
/// UI-binds it there before <see cref="CreatorIdentity"/> is ever constructed, so the module owns
/// the identity behavior and reaches the state through this interface instead.
/// The production implementation is <see cref="Settings"/>; tests inject an in-memory fake.
/// </summary>
internal interface ICreatorIdentityStore {
  /// <summary>
  /// The persisted Creator ID, read and rewritten by the bootstrap.
  /// </summary>
  string? CreatorID { get; set; }

  /// <summary>
  /// Whether <see cref="CreatorID"/> was acquired from the Paradox account rather than generated
  /// locally.
  /// </summary>
  bool IsParadoxAccountID { get; set; }

  /// <summary>
  /// The Creator Name; the module only reads it (to diff name edits and to assemble the
  /// credential).
  /// </summary>
  string? CreatorName { get; }

  /// <summary>
  /// The masked Creator ID, used only in the bootstrap log lines.
  /// </summary>
  string? MaskedCreatorID { get; }

  /// <summary>
  /// Sink for the Options-panel login status text, written by the login sync.
  /// </summary>
  LocalizedString LoginStatus { set; }

  /// <summary>
  /// Persists the settings to disk, called by the bootstrap once the resolved ID changed.
  /// </summary>
  void Save();
}
