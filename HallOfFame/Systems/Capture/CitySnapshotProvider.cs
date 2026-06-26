using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Game.City;
using Game.Rendering;
using Game.Simulation;
using Game.UI;
using HallOfFame.Reflection;
using HallOfFame.Utils;
using Unity.Entities;

namespace HallOfFame.Systems.Capture;

/// <summary>
/// Reads city facts from the game's ECS world and the Paradox SDK, isolating all that engine
/// reach-through out of <see cref="CaptureUISystem"/>.
/// Engine-bound and therefore not unit-testable off-engine; it intentionally has no interface
/// because the only consumer (the capture system) is itself an untestable ECS system, so a fake
/// would never be used.
/// </summary>
internal sealed class CitySnapshotProvider {
  /// <summary>
  /// World owning the entities, used to read the <see cref="EntityManager"/> for the population.
  /// </summary>
  private readonly World world;

  private readonly CitySystem citySystem;

  private readonly CityConfigurationSystem cityConfigurationSystem;

  private readonly PhotoModeRenderSystem photoModeRenderSystem;

  private readonly MapMetadataSystem mapMetadataSystem;

  /// <summary>
  /// Query for the singleton holding the achieved milestone level.
  /// Created and owned by the calling system so its lifetime stays system-managed; the provider
  /// must not create it itself, which would force manual disposal here.
  /// </summary>
  private readonly EntityQuery milestoneLevelQuery;

  /// <summary>
  /// Lazily hydrated list of the active playset mods (excluding Hall of Fame), invalidated when the
  /// game state changes via <see cref="InvalidateModsCache"/>.
  /// </summary>
  private Colossal.PSI.Common.Mod[]? activeModsCache;

  internal CitySnapshotProvider(World world, EntityQuery milestoneLevelQuery) {
    this.world = world;
    this.citySystem = world.GetOrCreateSystemManaged<CitySystem>();
    this.cityConfigurationSystem = world.GetOrCreateSystemManaged<CityConfigurationSystem>();
    this.photoModeRenderSystem = world.GetOrCreateSystemManaged<PhotoModeRenderSystem>();
    this.mapMetadataSystem = world.GetOrCreateSystemManaged<MapMetadataSystem>();
    this.milestoneLevelQuery = milestoneLevelQuery;
  }

  /// <summary>
  /// Gets the name of the map that was used to create this save.
  /// </summary>
  internal string? GetMapName() {
    var mapName = this.mapMetadataSystem.mapName;

    // In some unclear circumstances (reproducible on an old save), this can be null.
    // (It is also annotated with [CanBeNull].)
    if (mapName is null) {
      return null;
    }

    // The dictionary contains not only Vanilla map names but also map names from mods.
    // Ex. A mod will have a mapName "DunedinNewZealandReleaseFINAL" (its save name), and this will
    // be loaded as `Maps.MAP_TITLE[DunedinNewZealandReleaseFINAL]` = "Dunedin, New Zealand".
    // If the map mod was removed, though, the map display name is lost, and we use mapName
    // (so "DunedinNewZealandReleaseFINAL") as a fallback value.
    return $"Maps.MAP_TITLE[{mapName}]".Translate(mapName);
  }

  /// <summary>
  /// Gets the name of the city.
  /// </summary>
  internal string GetCityName() => this.cityConfigurationSystem.cityName ?? string.Empty;

  /// <summary>
  /// Gets the current achieved milestone level.
  /// </summary>
  internal int GetAchievedMilestone() =>
    this.milestoneLevelQuery.IsEmptyIgnoreFilter
      ? 0
      : this.milestoneLevelQuery
        // ReSharper disable once PossiblyImpureMethodCallOnReadonlyVariable
        .GetSingleton<MilestoneLevel>()
        .m_AchievedMilestone;

  /// <summary>
  /// Gets the current population of the city.
  /// </summary>
  internal int GetPopulation() =>
    this.world.EntityManager.HasComponent<Population>(this.citySystem.City)
      ? this.world.EntityManager
        .GetComponentData<Population>(this.citySystem.City)
        .m_Population
      : 0;

  /// <summary>
  /// Gets the mods from the current playset.
  /// It DOES NOT return HoF among the list.
  /// </summary>
  internal async Task<Colossal.PSI.Common.Mod[]> GetActiveMods() {
    if (this.activeModsCache is not null) {
      return this.activeModsCache;
    }

    try {
      var pdxSdk = PdxSdkPlatformProxy.PdxSdk;

      // This will return null if the player is not logged in or in other error cases.
      var mods = pdxSdk is not null ? await pdxSdk.GetModsInActivePlayset() ?? [] : [];

      return this.activeModsCache = mods
        // Ignore Hall of Fame's ID
        .Where(mod => mod.id != "90641")
        .ToArray();
    }
    catch (Exception ex) {
      Mod.Log.ErrorRecoverable(ex);

      return [];
    }
  }

  /// <summary>
  /// Invalidates the active mods cache so it is recomputed on the next call.
  /// Called when the game state changes, so ex. if a user leaves to Paradox Mods and installs a
  /// mod, it will be picked up if they reopen a save just after.
  /// </summary>
  internal void InvalidateModsCache() {
    this.activeModsCache = null;
  }

  /// <summary>
  /// Saves the values used by the photo mode render system to a dictionary of property ID => value
  /// (always a float).
  /// That is enough info to restore them later!
  /// </summary>
  internal IDictionary<string, float> GetPhotoModePropertiesSnapshot() {
    try {
      return this.photoModeRenderSystem.photoModeProperties.Values
        .Where(prop =>
          prop.getValue is not null &&
          prop.isEnabled is not null &&
          prop.isEnabled()
        )
        .ToDictionary(prop => prop.id, prop => prop.getValue());
    }
    catch (Exception ex) {
      Mod.Log.ErrorRecoverable(ex);

      return new Dictionary<string, float>();
    }
  }
}
