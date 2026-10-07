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

  [Fact]
  public void Decode_SkyveVerdict_KeepsItsFiveParts() {
    var mod = JSON.MakeInto<HallOfFame.Domain.Mod>(
      JSON.Load(
        """
        {
          "knownLastReleasedAt": "2026-09-18T14:48:50.000Z",
          "skyve": {
            "stability": "brokenFromPatch",
            "note": "Broke on 1.6.\r\n\r\nWait for an update.",
            "reviewedAt": "2026-09-15T16:16:02.537Z",
            "reviewedAtFormattedDistance": "22 days ago",
            "reviewedGameVersion": "1.6.2f1"
          }
        }
        """
      )
    );

    Assert.Equal("2026-09-18T14:48:50.000Z", mod.KnownLastReleasedAt);
    Assert.NotNull(mod.Skyve);
    Assert.Equal("brokenFromPatch", mod.Skyve.Stability);
    Assert.Equal("Broke on 1.6.\r\n\r\nWait for an update.", mod.Skyve.Note);
    Assert.Equal("2026-09-15T16:16:02.537Z", mod.Skyve.ReviewedAt);
    Assert.Equal("22 days ago", mod.Skyve.ReviewedAtFormattedDistance);
    Assert.Equal("1.6.2f1", mod.Skyve.ReviewedGameVersion);
  }

  /// <summary>
  /// The server sends a null verdict for a mod Skyve has not reviewed.
  /// </summary>
  [Fact]
  public void Decode_NullSkyveVerdict_GivesNull() {
    var mod = JSON.MakeInto<HallOfFame.Domain.Mod>(
      JSON.Load(
        """
        {
          "knownLastReleasedAt": null,
          "skyve": null
        }
        """
      )
    );

    Assert.Null(mod.KnownLastReleasedAt);
    Assert.Null(mod.Skyve);
  }

  /// <summary>
  /// The server sends null for each part of a verdict Skyve left out, the stability aside.
  /// </summary>
  [Fact]
  public void Decode_SkyveVerdictNullParts_GivesNull() {
    var mod = JSON.MakeInto<HallOfFame.Domain.Mod>(
      JSON.Load(
        """
        {
          "skyve": {
            "stability": "stable",
            "note": null,
            "reviewedAt": null,
            "reviewedAtFormattedDistance": null,
            "reviewedGameVersion": null
          }
        }
        """
      )
    );

    Assert.NotNull(mod.Skyve);
    Assert.Equal("stable", mod.Skyve.Stability);
    Assert.Null(mod.Skyve.Note);
    Assert.Null(mod.Skyve.ReviewedAt);
    Assert.Null(mod.Skyve.ReviewedAtFormattedDistance);
    Assert.Null(mod.Skyve.ReviewedGameVersion);
  }
}
