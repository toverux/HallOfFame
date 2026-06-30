using System;
using System.IO;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.PSI.Environment;
using Colossal.UI;
using Game;
using Game.Modding;
using HallOfFame.Http;
using HallOfFame.Logging;
using HallOfFame.Reflection;
using HallOfFame.Services;
using HallOfFame.Systems;
using HallOfFame.Utils;
using JetBrains.Annotations;
using UnityEngine;
#if DEBUG
using Game.SceneFlow;
#endif

namespace HallOfFame;

[UsedImplicitly]
public sealed class Mod : IMod {
  /// <summary>
  /// A little more than a singleton, it is set only when the mod has successfully finished its
  /// <see cref="OnLoad"/> and reset when disposed.
  /// </summary>
  /// <exception cref="NullReferenceException">
  /// If the mod has not been loaded yet.
  /// </exception>
  // ReSharper disable once UnusedMember.Global
  public static Mod Instance =>
    Mod.instanceValue ??
    throw new NullReferenceException($"Mod {nameof(Mod.OnLoad)}() was not called yet.");

  /// <exception cref="NullReferenceException">
  /// If the mod settings have not been loaded yet.
  /// </exception>
  public static Settings Settings =>
    Mod.instanceValue?.settingsValue ??
    throw new NullReferenceException($"Mod {nameof(Mod.OnLoad)}() was not called yet.");

  /// <summary>
  /// Seam over the Hall of Fame server API, consumed by the framework layer (systems,
  /// <see cref="Settings"/>) directly, and passed by them to plain <c>Services/</c> classes through
  /// their constructor.
  /// Built in <see cref="OnLoad"/>; there is no setter, tests inject a fake into the plain class
  /// under test instead.
  /// </summary>
  /// <exception cref="NullReferenceException"> If the mod has not been loaded yet.
  /// </exception>
  internal static IHallOfFameApi Api =>
    Mod.apiValue ??
    throw new NullReferenceException($"Mod {nameof(Mod.OnLoad)}() was not called yet.");

  /// <summary>
  /// The creator identity module: owns the Creator ID bootstrap, the login sync, and the assembly
  /// of the per-request authorization credential the HTTP layer reads at call time.
  /// Built and wired in <see cref="OnLoad"/>; there is no setter, tests construct the module with
  /// fakes instead.
  /// </summary>
  /// <exception cref="NullReferenceException">If the mod has not been loaded yet.</exception>
  internal static CreatorIdentity CreatorIdentity =>
    Mod.creatorIdentityValue ??
    throw new NullReferenceException($"Mod {nameof(Mod.OnLoad)}() was not called yet.");

  internal static string GameScreenshotsPath { get; } =
    Path.Combine(EnvPath.kUserDataPath, "Screenshots");

  internal static string ModSettingsPath { get; } =
    Path.Combine(EnvPath.kUserDataPath, "ModsSettings", nameof(HallOfFame));

  internal static string ModDataPath { get; } =
    Path.Combine(EnvPath.kUserDataPath, "ModsData", nameof(HallOfFame));

  internal static IModLog Log { get; } = new ModLog(
    LogManager.GetLogger(nameof(HallOfFame))
      .SetShowsErrorsInUI(true)
      .SetEffectiveness(Level.All)
  );

  private static Mod? instanceValue;

  private static IHallOfFameApi? apiValue;

  private static CreatorIdentity? creatorIdentityValue;

  private Settings? settingsValue;

  public void OnLoad(UpdateSystem updateSystem) {
    #if DEBUG
    // In debug mode, eagerly check reflection hacks are working.
    ErrorDialogManagerAccessor.Init();
    PdxSdkPlatformProxy.Init();
    ScreenUtilityProxy.Init();
    #endif

    try {
      // Build the API seam consumed by the framework layer; it must exist before any system or the
      // settings login can use it.
      Mod.apiValue = new HttpQueries();

      // Create directories for settings and data.
      Mod.CreateDirectories();

      // Set up locales.
      LocaleLoader.Setup();

      // Migration from previous versions.
      // Does not error if the file does not exist.
      File.Delete(Path.Combine(Mod.ModSettingsPath, "CreatorID.txt"));

      // Register settings UI and load settings.
      this.settingsValue = new Settings(this);
      var defaultSettings = this.settingsValue.Clone();

      this.settingsValue.RegisterInOptionsUI();
      this.settingsValue.RegisterKeyBindings();

      AssetDatabase.global.LoadSettings(nameof(HallOfFame), this.settingsValue, defaultSettings);

      // Set singleton instance only when OnLoad is likely to complete.
      Mod.instanceValue = this;

      #if DEBUG
      GameManager.instance.localizationManager.AddSource(
        "en-US",
        new Settings.DevDictionarySource()
      );
      #endif

      // Build the creator identity module and publish it as a singleton before starting it: its
      // startup sync issues the first authorized request, whose credential is assembled through
      // Mod.CreatorIdentity.
      var identity = new CreatorIdentity(
        Mod.Api,
        Mod.Log,
        this.settingsValue,
        SystemInfo.deviceUniqueIdentifier,
        new ParadoxConnection()
      );

      Mod.creatorIdentityValue = identity;

      identity.Start();

      // Re-sync when settings are applied: a Creator Name edit syncs the name and shows the result,
      // any other change pushes the updated info silently.
      this.settingsValue.onSettingsApplied += _ => identity.OnSettingsApplied();

      // Adds "coui://halloffame/" host location for serving images.
      UIManager.defaultUISystem.AddHostLocation(
        "halloffame",
        Mod.ModDataPath,

        // True by default, but it makes the whole UI reload when an image changes with
        // --uiDeveloperMode.
        // But we don't desire that for this host, whether in dev mode or not.
        false
      );

      // Initialize subsystems.
      updateSystem.UpdateAt<StatsNotificationSystem>(SystemUpdatePhase.MainLoop);
      updateSystem.UpdateAt<CommonUISystem>(SystemUpdatePhase.UIUpdate);
      updateSystem.UpdateAt<SlideshowUISystem>(SystemUpdatePhase.UIUpdate);
      updateSystem.UpdateAt<Systems.Capture.CaptureUISystem>(SystemUpdatePhase.UIUpdate);

      Mod.Log.Verbose($"{nameof(Mod)}: {nameof(this.OnLoad)} complete.");
    }
    catch (Exception ex) {
      Mod.Log.ErrorFatal(ex);
    }
  }

  public void OnDispose() {
    // Nothing particular to do here.
    // There is no need to clean up things like localization, the host location, event listeners,
    // etc., as you can't just unload and reload a mod, disposing only happens when quitting the
    // game, so here we only need to clean up things that are observable after the process exited.
  }

  private static void CreateDirectories() {
    // No need to check if they exist, CreateDirectory does it for us.
    Directory.CreateDirectory(Mod.GameScreenshotsPath);
    Directory.CreateDirectory(Mod.ModSettingsPath);
    Directory.CreateDirectory(Mod.ModDataPath);
  }
}
