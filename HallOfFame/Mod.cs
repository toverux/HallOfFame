using System;
using System.Linq;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Game;
using Game.Modding;
using Game.SceneFlow;
using HallOfFame.Patches;
using HallOfFame.Systems;
using HallOfFame.Utils;
using HarmonyLib;
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

    internal static ILog Log { get; } =
        LogManager.GetLogger($"{nameof(HallOfFame)}.{nameof(Mod)}")
            .SetShowsErrorsInUI(true);

    private const string HarmonyId = "io.mtq.cs2.halloffame";

    private static Mod? instanceValue;

    private Settings? settingsValue;

    private Harmony? harmony;

    public void OnLoad(UpdateSystem updateSystem) {
        try {
            // Register Harmony patches and print debug logs.
            this.harmony = new Harmony(Mod.HarmonyId);
            PhotoModeUISystemPatch.Install(this.harmony);

            var patchedMethods = this.harmony.GetPatchedMethods().ToArray();

            Mod.Log.Info(
                $"Registered as harmony plugin \"{Mod.HarmonyId}\". " +
                $"Patched methods: {patchedMethods.Length}");

            foreach (var method in patchedMethods) {
                Mod.Log.Info(
                    $"Patched method: {method.FullDescription()} " +
                    $"[{method.Module.Name}]");
            }

            #if DEBUG
            // This will create harmony.log.txt on the Desktop, with generated
            // IL debug output.
            Harmony.DEBUG = true;
            #endif

            // Register settings UI and load settings.
            this.settingsValue = new Settings(this);
            this.settingsValue.RegisterInOptionsUI();

            AssetDatabase.global.LoadSettings(
                nameof(HallOfFame), this.settingsValue, new Settings(this));

            // Initialize subsystems.
            updateSystem.UpdateAt<HallOfFameUISystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<HallOfFameMenuUISystem>(SystemUpdatePhase.UIUpdate);
            updateSystem.UpdateAt<HallOfFameGameUISystem>(SystemUpdatePhase.UIUpdate);

            // Done!
            Mod.instanceValue = this;

            Mod.Log.Info($"{nameof(this.OnLoad)} complete.");
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
        // Unregister Harmony patches.
        if (this.harmony is not null) {
            this.harmony.UnpatchAll(Mod.HarmonyId);
            this.harmony = null;

            Mod.Log.Info("Unregistered Harmony patches.");
        }

        // Unregister settings UI
        if (this.settingsValue is not null) {
            this.settingsValue.UnregisterInOptionsUI();
            this.settingsValue = null;
        }

        Mod.instanceValue = null;

        Mod.Log.Info($"{nameof(this.OnDispose)} complete.");
    }
}
