using System;
using System.IO;
using Colossal;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.PSI.Environment;
using Colossal.UI;
using Game;
using Game.Modding;
using HallOfFame.Systems;
using HallOfFame.Utils;
using JetBrains.Annotations;

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
    throw new NullReferenceException(
      $"Mod {nameof(Mod.OnLoad)}() was not called yet.");

  /// <exception cref="NullReferenceException">
  /// If the mod settings have not been loaded yet.
  /// </exception>
  public static Settings Settings =>
    Mod.instanceValue?.settingsValue ??
    throw new NullReferenceException(
      $"Mod {nameof(Mod.OnLoad)}() was not called yet.");

  internal static string GameScreenshotsPath { get; } =
    Path.Combine(EnvPath.kUserDataPath, ScreenUtility.kScreenshotDirectory);

  internal static string ModSettingsPath { get; } =
    Path.Combine(EnvPath.kUserDataPath, "ModsSettings", nameof(HallOfFame));

  internal static string ModDataPath { get; } =
    Path.Combine(EnvPath.kUserDataPath, "ModsData", nameof(HallOfFame));

  internal static ILog Log { get; } =
    LogManager.GetLogger(nameof(HallOfFame)).SetShowsErrorsInUI(true);

  private static Mod? instanceValue;

  private Settings? settingsValue;

  public void OnLoad(UpdateSystem updateSystem) {
    try {
      // Create directories for settings and data.
      Mod.CreateDirectories();

      // Set up locales.
      LocaleLoader.Setup();

      // Migration from previous versions.
      // Does not error if the file does not exist.
      File.Delete(Path.Combine(Mod.ModSettingsPath, "CreatorID.txt"));

      // Register settings UI and load settings.
      this.settingsValue = new Settings(this);
      this.settingsValue.RegisterInOptionsUI();
      this.settingsValue.RegisterKeyBindings();

      AssetDatabase.global.LoadSettings(
        nameof(HallOfFame), this.settingsValue, new Settings(this));

      // Set singleton instance only when OnLoad is likely to complete.
      Mod.instanceValue = this;

      this.settingsValue.Initialize();

      // Adds "coui://halloffame/" host location for serving images.
      UIManager.defaultUISystem.AddHostLocation(
        "halloffame",
        Mod.ModDataPath,

        // True by default, but it makes the whole UI reload when an image changes with
        // --uiDeveloperMode.
        // But we don't desire that for this host, whether in dev mode or not.
        shouldWatch: false);

      // Initialize subsystems.
      updateSystem.UpdateAt<StatsNotificationSystem>(SystemUpdatePhase.MainLoop);
      updateSystem.UpdateAt<CommonUISystem>(SystemUpdatePhase.UIUpdate);
      updateSystem.UpdateAt<PresenterUISystem>(SystemUpdatePhase.UIUpdate);
      updateSystem.UpdateAt<Systems.CaptureUISystem>(SystemUpdatePhase.UIUpdate);

      Mod.Log.Info($"Mod: {nameof(this.OnLoad)} complete.");
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
