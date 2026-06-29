using Game.UI.Localization;
using HallOfFame.Services;

namespace HallOfFame.Tests.Services;

/// <summary>
/// In-memory <see cref="ICreatorIdentityStore"/> test double standing in for the persisted identity
/// state that lives on <c>Settings</c>.
/// The state properties are plain auto-properties the test seeds and reads back; the write-only
/// <see cref="ICreatorIdentityStore.LoginStatus"/> sink and the <see cref="Save"/> side effect are
/// recorded so a test can assert on them.
/// </summary>
internal sealed class FakeStore : ICreatorIdentityStore {
  public string? CreatorID { get; set; }

  public bool IsParadoxAccountID { get; set; }

  public string? CreatorName { get; set; }

  public string? MaskedCreatorID { get; set; }

  /// <summary>
  /// The last value written to <see cref="ICreatorIdentityStore.LoginStatus"/>, or <c>null</c> when
  /// it was never written.
  /// </summary>
  internal LocalizedString? LastLoginStatus { get; private set; }

  /// <summary>
  /// Number of times <see cref="Save"/> was called.
  /// </summary>
  internal int SaveCount { get; private set; }

  LocalizedString ICreatorIdentityStore.LoginStatus {
    set => this.LastLoginStatus = value;
  }

  public void Save() => this.SaveCount++;
}
