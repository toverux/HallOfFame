using System;
using System.IO;
using Colossal;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Colossal.PSI.Environment;
using Colossal.UI;
using Game;
using Game.Modding;
using Game.SceneFlow;
using HallOfFame.Systems;
using HallOfFame.Utils;
using JetBrains.Annotations;

namespace HallOfFame;

[UsedImplicitly]
public sealed class Mod : IMod {
    /// <summary>
    /// A little more than a singleton, it is set only when the mod has
    /// successfully finished its <see cref="OnLoad"/> and reset when disposed.
    /// </summary>
    /// <exception cref="NullReferenceException">
    /// If the mod has not been loaded yet.
    /// </exception>
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
            this.CreateDirectories();

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

                // True by default, but it makes the whole UI reload when an
                // image changes with --uiDeveloperMode. But we don't desire
                // that for this host, whether in dev mode or not.
                shouldWatch: false);

            // Initialize subsystems.
            updateSystem.UpdateAt<MenuNotificationSystem>(
                SystemUpdatePhase.MainLoop);

            updateSystem.UpdateAt<GlobalUISystem>(SystemUpdatePhase.UIUpdate);

            updateSystem.UpdateAt<MenuUISystem>(SystemUpdatePhase.UIUpdate);

            updateSystem.UpdateAt<GameUISystem>(SystemUpdatePhase.UIUpdate);

            Mod.Log.Info($"Mod: {nameof(this.OnLoad)} complete.");
        }
        catch (Exception ex) {
            // We have to delay this to the next frame because it uses
            // translations and I18n EveryWhere might not be ready just yet.
            // Especially in development where we can't change load order.
            // All mods OnLoad()s are executed in the same frame, so this is
            // deterministic.
            GameManager.instance.RegisterUpdater(() => Mod.Log.ErrorFatal(ex));
        }
    }

    public void OnDispose() {
        // Run dispose logic on the next frame because systems are destroyed
        // after IMods are disposed, so this can cause null references for our
        // systems while they're living their last moments.
        GameManager.instance.RegisterUpdater(() => {
            // Unregister settings UI
            if (this.settingsValue is not null) {
                this.settingsValue.UnregisterInOptionsUI();
                this.settingsValue = null;
            }

            // Remove our custom coui:// host.
            UIManager.defaultUISystem.RemoveHostLocation("halloffame");

            Mod.instanceValue = null;

            Mod.Log.Info($"Mod: {nameof(this.OnDispose)} complete.");
        });
    }

    private void CreateDirectories() {
        // No need to check if they exist, CreateDirectory does it for us.
        Directory.CreateDirectory(Mod.GameScreenshotsPath);
        Directory.CreateDirectory(Mod.ModSettingsPath);
        Directory.CreateDirectory(Mod.ModDataPath);
    }
}
