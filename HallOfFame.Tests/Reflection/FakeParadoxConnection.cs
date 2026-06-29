using System;
using HallOfFame.Reflection;

namespace HallOfFame.Tests.Reflection;

/// <summary>
/// Handwritten <see cref="IParadoxConnection"/> test double.
/// <see cref="ReadAccountId"/> is wired per test through <see cref="ReadAccountIdImpl"/> (and
/// throws when left unwired, mirroring <c>FakeApi</c>); the warning dialog is a pure side effect,
/// so it is recorded as a call count instead.
/// </summary>
internal sealed class FakeParadoxConnection : IParadoxConnection {
  internal Func<string?>? ReadAccountIdImpl { get; init; }

  /// <summary>
  /// Number of times <see cref="ShowNoParadoxConnectionWarning"/> was called.
  /// </summary>
  internal int WarningShownCount { get; private set; }

  public string? ReadAccountId() =>
    this.ReadAccountIdImpl is not null
      ? this.ReadAccountIdImpl()
      : throw new NotImplementedException();

  public void ShowNoParadoxConnectionWarning() => this.WarningShownCount++;
}
