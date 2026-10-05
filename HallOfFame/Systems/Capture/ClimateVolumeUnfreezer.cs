using System;
using Game.Rendering;
using Game.UI.InGame;
using Unity.Entities;
using Object = UnityEngine.Object;

namespace HallOfFame.Systems.Capture;

/// <summary>
/// Works around a game bug: opening photo mode reads the climate volume's <c>profile</c>, which
/// makes Unity give the volume a private copy of its shared profile and render that copy from then
/// on.
/// The weather keeps updating the shared profile, so the exposure and white balance the game picks,
/// and probably the clouds and fog, stop following the season and the weather for the rest of the
/// session, which the conditions recorded at capture would inherit.
/// Each time photo mode opens, the copy is destroyed, so the volume renders the shared profile
/// again; a copy found missing means the game no longer makes one.
/// The scenario editor opens photo mode without the panel event this listens to, and stays
/// affected.
/// Engine-bound and therefore not unit-testable off-engine.
/// </summary>
internal sealed class ClimateVolumeUnfreezer {
  private readonly ClimateRenderSystem climateRenderSystem;

  /// <summary>
  /// Mutable: set the first time the copy is destroyed, so the log says it once per session.
  /// </summary>
  private bool hasActed;

  internal ClimateVolumeUnfreezer(World world) {
    this.climateRenderSystem = world.GetOrCreateSystemManaged<ClimateRenderSystem>();

    // Raised once the game has activated photo mode, which made the copy.
    world.GetOrCreateSystemManaged<GamePanelUISystem>().eventPanelOpened += this.OnPanelOpened;
  }

  private void OnPanelOpened(GamePanel panel) {
    if (panel is not PhotoModePanel) {
      return;
    }

    try {
      var volume = this.climateRenderSystem.climateControlVolume;

      // Compared with ==, which tells a destroyed Unity object, and without reading `profile`,
      // which would make the copy.
      if (volume == null || !volume.HasInstantiatedProfile()) {
        return;
      }

      var copy = volume.profile;

      // The volume renders its shared profile when it holds no copy.
      volume.profile = null;

      // The copy owns copies of the shared profile's components.
      foreach (var component in copy.components) {
        Object.Destroy(component);
      }

      Object.Destroy(copy);

      if (!this.hasActed) {
        this.hasActed = true;

        Mod.Log.Info(
          $"{nameof(ClimateVolumeUnfreezer)}: Photo mode froze the climate volume's profile, " +
          "restored the shared one. Logged once per session."
        );
      }
    }
    catch (Exception ex) {
      // Silently, as a workaround: a game update breaking it would otherwise raise an error
      // dialog each time photo mode opens.
      Mod.Log.ErrorSilent(ex);
    }
  }
}
