using System.Linq;
using HallOfFame.Systems.Capture;
using Xunit;
using PsiMod = Colossal.PSI.Common.Mod;

namespace HallOfFame.Tests.Systems.Capture;

public sealed class CitySnapshotProviderTests {
  [Fact]
  public void SelectAssetMods_ModWithNullTags_IsLeftOut() {
    PsiMod[] mods = [
      new() {
        id = "1",
        displayName = "Untagged",
        tags = null
      },
      new() {
        id = "2",
        displayName = "Bridges",
        tags = ["Prefab"]
      }
    ];

    var selected = CitySnapshotProvider.SelectAssetMods(mods);

    Assert.Equal(["2"], selected.Select(mod => mod.id));
  }

  [Fact]
  public void SelectAssetMods_KeepsPrefabAndMapMods_SortedByDisplayName() {
    PsiMod[] mods = [
      new() {
        id = "1",
        displayName = "Zoning Toolkit",
        tags = ["Code Mod"]
      },
      new() {
        id = "2",
        displayName = "Harbor Cranes",
        tags = ["Prefab"]
      },
      new() {
        id = "3",
        displayName = "Alpine Valley",
        tags = ["Map"]
      },
      new() {
        id = "4",
        displayName = "Mixed Pack",
        tags = ["Code Mod", "Prefab"]
      },
      new() {
        id = "5",
        displayName = "Bare",
        tags = []
      }
    ];

    var selected = CitySnapshotProvider.SelectAssetMods(mods);

    Assert.Equal(["3", "2", "4"], selected.Select(mod => mod.id));
  }
}
