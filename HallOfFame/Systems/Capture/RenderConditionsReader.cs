using System;
using System.Collections.Generic;
using System.Linq;
using Game.City;
using Game.Prefabs;
using Game.Rendering;
using Game.Settings;
using Game.Simulation;
using Game.UI.InGame;
using Unity.Entities;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.Rendering.HighDefinition;

namespace HallOfFame.Systems.Capture;

/// <summary>
/// Samples the conditions a screenshot is taken in: the scene, the light, the options changing what
/// they mean, the camera, and the graphics options bearing on the light.
/// They form an open map of names to numbers, text, or booleans, which the server stores as is and
/// the UI reads by name, ignoring the names it does not know: a condition is added here alone.
/// Engine-bound, so only <see cref="RemoveNonFiniteNumbers"/> is unit-testable off-engine.
/// The reader intentionally has no interface because its only consumer, the capturer, is itself
/// engine-bound.
/// </summary>
internal sealed class RenderConditionsReader(World world) {
  private readonly CityConfigurationSystem cityConfigurationSystem =
    world.GetOrCreateSystemManaged<CityConfigurationSystem>();

  private readonly PlanetarySystem planetarySystem =
    world.GetOrCreateSystemManaged<PlanetarySystem>();

  private readonly ClimateSystem climateSystem = world.GetOrCreateSystemManaged<ClimateSystem>();

  private readonly ClimateUISystem climateUISystem =
    world.GetOrCreateSystemManaged<ClimateUISystem>();

  private readonly LightingSystem lightingSystem = world.GetOrCreateSystemManaged<LightingSystem>();

  private readonly PrefabSystem prefabSystem = world.GetOrCreateSystemManaged<PrefabSystem>();

  private readonly TerrainSystem terrainSystem = world.GetOrCreateSystemManaged<TerrainSystem>();

  private readonly WaterSystem waterSystem = world.GetOrCreateSystemManaged<WaterSystem>();

  /// <summary>
  /// Reads the conditions in effect for <paramref name="camera"/>, which must have rendered the
  /// shot: the post-processing values are read from the camera's own volume stack, which a render
  /// updates, and which is where the game itself reads what it rendered.
  /// A failed read is logged and gives an empty map, which the UI reads as no conditions.
  /// </summary>
  internal Dictionary<string, object> Read(Camera camera, CaptureOverrides overrides) {
    var conditions = new Dictionary<string, object>();

    try {
      this.ReadScene(conditions);
      this.ReadLight(conditions, camera);
      RenderConditionsReader.ReadOptions(conditions);
      this.ReadCamera(conditions, camera);

      conditions["capture.isDlssForcedOff"] = overrides.IsDlssForcedOff;
      conditions["capture.isDynamicResolutionForcedOff"] = overrides.IsDynamicResolutionForcedOff;
      conditions["capture.isGlobalIlluminationForcedOff"] = overrides.IsGlobalIlluminationForcedOff;

      RenderConditionsReader.RemoveNonFiniteNumbers(conditions);
    }
    catch (Exception ex) {
      Mod.Log.ErrorRecoverable(ex);

      conditions.Clear();
    }

    return conditions;
  }

  /// <summary>
  /// Leaves out the numbers JSON cannot write, which the server would refuse the whole upload
  /// over: a read the engine could not settle, like the arcsine of a sun height rounded past 1.
  /// </summary>
  internal static void RemoveNonFiniteNumbers(Dictionary<string, object> conditions) {
    var names = conditions
      .Where(condition => condition.Value is float value && !math.isfinite(value))
      .Select(condition => condition.Key)
      .ToList();

    foreach (var name in names) {
      conditions.Remove(name);
    }
  }

  private void ReadScene(Dictionary<string, object> conditions) {
    // The hour the sun is placed at, not the simulation clock: photo mode's Time of Day and the
    // Day/Night visuals option both set it apart from the clock.
    conditions["time.hour"] = this.planetarySystem.time;

    // Set by photo mode's Time of Day, which overrides the hour whatever the options say.
    conditions["time.isOverridden"] = this.planetarySystem.overrideTime;

    conditions["time.dayOfYear"] = this.planetarySystem.dayOfYear;

    // The map's, even while the Day/Night visuals option makes the sun ignore them.
    conditions["map.latitude"] = this.planetarySystem.latitude;
    conditions["map.longitude"] = this.planetarySystem.longitude;

    // The city's theme, the regional style of its buildings and vehicles.
    if (this.cityConfigurationSystem.defaultTheme != Entity.Null) {
      conditions["city.theme"] =
        this.prefabSystem.GetPrefabName(this.cityConfigurationSystem.defaultTheme);
    }

    if (this.climateSystem.currentClimate != Entity.Null) {
      conditions["climate.name"] =
        this.prefabSystem.GetPrefabName(this.climateSystem.currentClimate);
    }

    // The name the game localizes the season with, `Climate.SEASON[<name>]`.
    if (this.climateSystem.currentSeasonName is {} seasonName) {
      conditions["climate.season"] = seasonName;
    }

    conditions["climate.temperature"] = (float) this.climateSystem.temperature;
    conditions["climate.cloudiness"] = (float) this.climateSystem.cloudiness;
    conditions["climate.precipitation"] = (float) this.climateSystem.precipitation;
    conditions["climate.fog"] = (float) this.climateSystem.fog;
    conditions["climate.aurora"] = (float) this.climateSystem.aurora;
    conditions["climate.isRaining"] = this.climateSystem.isRaining;
    conditions["climate.isSnowing"] = this.climateSystem.isSnowing;

    // The weather as the game's own toolbar shows it, e.g. "Scattered" or "Rain".
    conditions["climate.weather"] = this.climateUISystem.GetWeather().ToString();
  }

  private void ReadLight(Dictionary<string, object> conditions, Camera camera) {
    if (this.planetarySystem.SunLight.isValid) {
      float3 sunPosition = this.planetarySystem.SunLight.transform.position;

      conditions["sun.elevation"] = math.degrees(math.asin(math.normalize(sunPosition).y));
    }

    // The climate caps the sun's height, easing it from the first angle to the second.
    conditions["sun.elevationCapStart"] = (float) math.degrees(this.planetarySystem.sunLimit.x);
    conditions["sun.elevationCap"] = (float) math.degrees(this.planetarySystem.sunLimit.y);

    conditions["light.dayPhase"] = this.lightingSystem.state.ToString();

    var stack = HDCamera.GetOrCreate(camera).volumeStack;

    var colorAdjustments = stack.GetComponent<ColorAdjustments>();

    conditions["post.exposure"] = colorAdjustments.postExposure.value;
    conditions["post.contrast"] = colorAdjustments.contrast.value;
    conditions["post.saturation"] = colorAdjustments.saturation.value;
    conditions["post.hueShift"] = colorAdjustments.hueShift.value;

    var whiteBalance = stack.GetComponent<WhiteBalance>();

    conditions["post.temperature"] = whiteBalance.temperature.value;
    conditions["post.tint"] = whiteBalance.tint.value;

    conditions["post.tonemapping"] = stack.GetComponent<Tonemapping>().mode.value.ToString();

    var exposure = stack.GetComponent<Exposure>();

    conditions["exposure.mode"] = exposure.mode.value.ToString();
    conditions["exposure.compensation"] = exposure.compensation.value;
  }

  private static void ReadOptions(Dictionary<string, object> conditions) {
    var gameplay = SharedSettings.instance.gameplay;

    // Off, the sun ignores the map's latitude and the clock, unless photo mode sets the hour.
    conditions["options.dayNightVisuals"] = gameplay.dayNightVisual;
    conditions["options.snowVisuals"] = gameplay.snowVisual;

    // Read during the capture, so they hold what the capturer forced for it.
    conditions["graphics.globalIllumination"] = Level<SSGIQualitySettings>();
    conditions["graphics.ambientOcclusion"] = Level<SSAOQualitySettings>();
    conditions["graphics.reflections"] = Level<SSRQualitySettings>();
    conditions["graphics.shadows"] = Level<ShadowsQualitySettings>();
    conditions["graphics.volumetrics"] = Level<VolumetricsQualitySettings>();
    conditions["graphics.clouds"] = Level<CloudsQualitySettings>();
    conditions["graphics.fog"] = Level<FogQualitySettings>();

    static string Level<T>() where T : QualitySetting {
      return SharedSettings.instance.graphics.GetQualitySetting<T>().GetLevel().ToString();
    }
  }

  private void ReadCamera(Dictionary<string, object> conditions, Camera camera) {
    var transform = camera.transform;
    var position = transform.position;
    var angles = transform.eulerAngles;

    conditions["camera.fieldOfView"] = camera.fieldOfView;
    conditions["camera.x"] = position.x;
    conditions["camera.y"] = position.y;
    conditions["camera.z"] = position.z;

    // Unity's angles run from 0 to 360, and its pitch turns the camera down: brought to -180 to
    // 180 here, positive looking up.
    conditions["camera.pitch"] = -Mathf.DeltaAngle(0, angles.x);
    conditions["camera.heading"] = angles.y;
    conditions["camera.roll"] = Mathf.DeltaAngle(0, angles.z);

    var waterSurface = this.waterSystem.GetSurfaceData(out var waterDependencies);

    waterDependencies.Complete();

    var terrainHeights = this.terrainSystem.GetHeightData();

    // Above the water surface where there is one, the terrain elsewhere.
    var groundHeight = WaterUtils.SampleHeight(
      ref waterSurface,
      ref terrainHeights,
      position,
      out bool _
    );

    conditions["camera.heightAboveGround"] = position.y - groundHeight;
  }

  /// <summary>
  /// The options the capturer forced for the shot, which the reader sees in effect without telling
  /// them from the player's own.
  /// </summary>
  internal readonly record struct CaptureOverrides(
    bool IsDlssForcedOff,
    bool IsDynamicResolutionForcedOff,
    bool IsGlobalIlluminationForcedOff
  );
}
