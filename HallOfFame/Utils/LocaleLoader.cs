using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Colossal.Json;
using Colossal.Localization;
using Game.SceneFlow;

namespace HallOfFame.Utils;

internal static class LocaleLoader {
    private static readonly List<string> LoadedLocales = [];

    internal static void Setup() {
        LocaleLoader.RefreshLocale();

        GameManager.instance.localizationManager.onActiveDictionaryChanged +=
            LocaleLoader.RefreshLocale;
    }

    private static void RefreshLocale() {
        var localeId =
            GameManager.instance.localizationManager.activeLocaleId;

        // Check locale wasn't loaded already.
        if (LocaleLoader.LoadedLocales.Contains(localeId)) {
            return;
        }

        // Mark as loaded right now so it is not tried again even if it fails.
        LocaleLoader.LoadedLocales.Add(localeId);

        // Find a .json resource for this locale.
        var assembly = typeof(LocaleLoader).Assembly;

        var resourceName = assembly
            .GetManifestResourceNames()
            .FirstOrDefault(name =>
                name.ToLowerInvariant()
                    .EndsWith(localeId.ToLowerInvariant() + ".json"));

        // Oops, we do not support this one.
        if (resourceName is null) {
            Mod.Log.Info(
                $"LocaleLoader: Skipping locale {localeId}, it is not supported by HoF.");
        }

        // Load locale resource and parse JSON.
        var resourceStream = assembly.GetManifestResourceStream(resourceName)!;

        using var reader = new StreamReader(resourceStream, Encoding.UTF8);

        var localeDictionary =
            JSON.MakeInto<Dictionary<string, string>>(
                JSON.Load(reader.ReadToEnd()));

        if (localeDictionary is null) {
            Mod.Log.ErrorSilent(
                $"LocaleLoader: Failed to parse resource file {resourceName}.");

            return;
        }

        // Register the locale dictionary.
        var source = new MemorySource(localeDictionary);

        GameManager.instance.localizationManager.AddSource(localeId, source);

        Mod.Log.Info($"LocaleLoader: Loaded locale {localeId}.");
    }
}
