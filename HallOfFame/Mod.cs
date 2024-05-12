using System.Linq;
using System.Reflection;
using Colossal.IO.AssetDatabase;
using Colossal.Logging;
using Game;
using Game.Modding;
using HarmonyLib;
using JetBrains.Annotations;

namespace HallOfFame;

[UsedImplicitly]
public class Mod : IMod {
    internal static readonly ILog Log =
        LogManager.GetLogger($"{nameof(HallOfFame)}.{nameof(Mod)}")
            .SetShowsErrorsInUI(false);

    private const string HarmonyId = "io.mtq.cs2.halloffame";

    private Settings? settings;

    private Harmony? harmony;

    public void OnLoad(UpdateSystem updateSystem) {
        // Register Harmony patches and print debug logs.
        this.harmony = new Harmony(Mod.HarmonyId);
        this.harmony.PatchAll(Assembly.GetExecutingAssembly());

        var patchedMethods = this.harmony.GetPatchedMethods().ToArray();
        Mod.Log.Info($"Registered as harmony plugin \"{Mod.HarmonyId}\". Patched methods: {patchedMethods.Length}");

        foreach (var method in patchedMethods) {
            Mod.Log.Info($"Patched method: {method.Module.Name}:{method.DeclaringType!.Name}.{method.Name}");
        }

        #if DEBUG
        // This will create harmony.log.txt on the Desktop, with generated IL debug output.
        Harmony.DEBUG = true;
        #endif

        // Register settings UI and load settings.
        this.settings = new Settings(this);
        this.settings.RegisterInOptionsUI();

        AssetDatabase.global.LoadSettings(nameof(HallOfFame), this.settings, new Settings(this));

        Mod.Log.Info($"{nameof(this.OnLoad)} complete.");
    }

    public void OnDispose() {
        // Unregister Harmony patches.
        if (this.harmony is not null) {
            this.harmony.UnpatchAll(Mod.HarmonyId);
            this.harmony = null;

            Mod.Log.Info("Unregistered Harmony patches.");
        }

        // Unregister settings UI
        if (this.settings is not null) {
            this.settings.UnregisterInOptionsUI();
            this.settings = null;
        }

        Mod.Log.Info($"{nameof(this.OnDispose)} complete.");
    }
}
