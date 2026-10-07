using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using Colossal.Json;
using Colossal.Localization;
using Game.SceneFlow;

namespace HallOfFame.Utils;

/// <summary>
/// Provides functionality for managing and loading locale dictionaries matching the current in-game
/// locale set by the user.
/// </summary>
internal static class LocaleLoader {
  private const string ResourcePrefix = "HallOfFame.Locales.";

  private const string SkyveResourcePrefix = "HallOfFame.Locales.Skyve.";

  private const string SkyveKeyPrefix = "HallOfFame.Skyve.";

  private static readonly List<string> LoadedLocales = [];

  /// <seealso cref="PostprocessLocaleDictionary"/>
  private static readonly Regex InterpolationPattern =
    new(@"\{KEY=([^}]+)\}", RegexOptions.Compiled);

  /// <seealso cref="PostprocessLocaleDictionary"/>
  private static readonly Regex CommentPattern =
    new(@"^\s*//.*(?:\r?\n)?", RegexOptions.Compiled | RegexOptions.Multiline);

  internal static void Setup() {
    // The game fills the gaps of the active locale from its fallback locale, which holds the mod's
    // strings only once they are registered under it: a locale the mod does not ship, or does not
    // translate fully, then reads them in English rather than as keys.
    // Their `{KEY=...}` game strings come from the active locale, the English one being private: a
    // player who switches to English mid-session keeps the start language's until a restart.
    LocaleLoader.LoadLocale(GameManager.instance.localizationManager.fallbackLocaleId);

    LocaleLoader.RefreshLocale();

    GameManager.instance.localizationManager.onActiveDictionaryChanged +=
      LocaleLoader.RefreshLocale;
  }

  private static void RefreshLocale() =>
    LocaleLoader.LoadLocale(GameManager.instance.localizationManager.activeLocaleId);

  /// <summary>
  /// Loads the mod's dictionary for a locale, processes its interpolations, and registers it into
  /// the localization manager, along with Skyve's labels.
  /// </summary>
  private static void LoadLocale(string localeId) {
    // Check locale wasn't loaded yet.
    if (LocaleLoader.LoadedLocales.Contains(localeId)) {
      return;
    }

    // Mark as loaded right now, so it is not tried again even if it fails.
    LocaleLoader.LoadedLocales.Add(localeId);

    // Load locale dictionary.
    var localeDictionary =
      LocaleLoader.ReadDictionary($"{LocaleLoader.ResourcePrefix}{localeId}.json");

    // Oops, we do not support this one.
    if (localeDictionary is null) {
      Mod.Log.Info(
        $"{nameof(LocaleLoader)}: Skipping locale {localeId}, it is not supported by HoF."
      );

      return;
    }

    // Manual patches -- strings that can't go into the JSON files.
    localeDictionary.Add(
      "HallOfFame.Common.SUPPORTERS",
      "bilibili Jason Stephen, CloverPie, Danil.V.L, elGendo87, foxxy, Fuchs23, Ghost Hardware, Hendrix, Jojodaisuke, karmel68, Konsi, MayorCheeks, Prophedt, TheBusStop, ThemisC2"
    );

    localeDictionary.Add(
      "Options.OPTION[HallOfFame.HallOfFame.Mod.Settings.LoginStatus]",
      string.Empty
    );

    // Remove comments and process interpolations in the dictionary.
    var processedLocaleDictionary = LocaleLoader.PostprocessLocaleDictionary(localeDictionary);

    // Skyve's labels, as Skyve words them, under keys of their own.
    var skyveDictionary = LocaleLoader.ReadDictionary(
      $"{LocaleLoader.SkyveResourcePrefix}{localeId}.json"
    );

    foreach (var entry in skyveDictionary ?? []) {
      processedLocaleDictionary[$"{LocaleLoader.SkyveKeyPrefix}{entry.Key}"] = entry.Value;
    }

    // Register the locale dictionary.
    var source = new MemorySource(processedLocaleDictionary);

    GameManager.instance.localizationManager.AddSource(localeId, source);

    Mod.Log.Verbose($"{nameof(LocaleLoader)}: Loaded locale {localeId}.");
  }

  /// <summary>
  /// Loads the JSON resource of the given name bundled in the assembly and parses it into a
  /// localization dictionary, null when there is no such resource.
  /// The name is matched exactly, so the mod's own strings and Skyve's labels, which share their
  /// file names, never stand in for one another.
  /// </summary>
  private static Dictionary<string, string>? ReadDictionary(string resourceName) {
    var assembly = typeof(LocaleLoader).Assembly;

    var resourceStream = assembly.GetManifestResourceStream(resourceName);

    if (resourceStream is null) {
      return null;
    }

    using var reader = new StreamReader(resourceStream, Encoding.UTF8);

    var localeDictionary =
      JSON.MakeInto<Dictionary<string, string>>(JSON.Load(reader.ReadToEnd()));

    if (localeDictionary is not null) {
      return localeDictionary;
    }

    Mod.Log.ErrorSilent($"LocaleLoader: Failed to parse resource file {resourceName}.");

    return new Dictionary<string, string>();
  }

  /// <summary>
  /// Processes a given locale dictionary by interpolating references to other dictionary keys
  /// within it and removing comment lines.
  /// Does not modify the source dictionary.
  /// </summary>
  private static Dictionary<string, string> PostprocessLocaleDictionary(
    Dictionary<string, string> dictionary
  ) {
    var gameDictionary = GameManager.instance.localizationManager.activeDictionary;

    var interpolatedDictionary = new Dictionary<string, string>(dictionary);

    foreach (var entry in dictionary) {
      // Remove lines starting with //.
      var value = LocaleLoader.CommentPattern.Replace(entry.Value, string.Empty);

      // Replace {KEY=...} with the value of the key in either the current or game dictionary.
      value = LocaleLoader.InterpolationPattern.Replace(
        value,
        match => {
          var key = match.Groups[1].Value;

          return interpolatedDictionary.TryGetValue(key, out var replacement)
            ? replacement
            : gameDictionary.TryGetValue(key, out var gameReplacement)
              ? gameReplacement
              : key;
        }
      );

      interpolatedDictionary[entry.Key] = value;
    }

    return interpolatedDictionary;
  }
}
