using HallOfFame.Services;

namespace HallOfFame.Tests.Services;

/// <summary>
/// In-memory <see cref="IUsageSettings"/> test double, its toggle flipped by the test.
/// </summary>
internal sealed class FakeUsageSettings : IUsageSettings {
  public bool SendUsageStatistics { get; set; } = true;
}
