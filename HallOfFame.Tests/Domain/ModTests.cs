using Colossal.Json;
using Xunit;

namespace HallOfFame.Tests.Domain;

public sealed class ModTests {
  [Fact]
  public void Decode_ParadoxHints_KeepsTheServerStrings() {
    var mod = JSON.MakeInto<HallOfFame.Domain.Mod>(
      JSON.Load(
        """
        {
          "state": "removed",
          "requiredGameVersion": "1.6.*",
          "sizeFormatted": "996.4 kB",
          "knownLastReleasedAtFormattedDistance": "13 days ago"
        }
        """
      )
    );

    Assert.Equal("removed", mod.State);
    Assert.Equal("1.6.*", mod.RequiredGameVersion);
    Assert.Equal("996.4 kB", mod.SizeFormatted);
    Assert.Equal("13 days ago", mod.KnownLastReleasedAtFormattedDistance);
  }

  /// <summary>
  /// The server sends null for a hint Paradox Mods did not give or gave in a shape it rejected.
  /// </summary>
  [Fact]
  public void Decode_NullParadoxHints_GivesNull() {
    var mod = JSON.MakeInto<HallOfFame.Domain.Mod>(
      JSON.Load(
        """
        {
          "state": "published",
          "requiredGameVersion": null,
          "sizeFormatted": null,
          "knownLastReleasedAtFormattedDistance": null
        }
        """
      )
    );

    Assert.Null(mod.RequiredGameVersion);
    Assert.Null(mod.SizeFormatted);
    Assert.Null(mod.KnownLastReleasedAtFormattedDistance);
  }
}
