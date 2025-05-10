using System.Collections.Generic;
using System.IO;
using System.Linq;
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
  private static readonly List<string> LoadedLocales = [];

  /// <seealso cref="PostprocessLocaleDictionary"/>
  private static readonly Regex InterpolationPattern =
    new(@"\{KEY=([^}]+)\}", RegexOptions.Compiled);

  /// <seealso cref="PostprocessLocaleDictionary"/>
  private static readonly Regex CommentPattern =
    new(@"^\s*//.*(?:\r?\n)?", RegexOptions.Compiled | RegexOptions.Multiline);

  internal static void Setup() {
    LocaleLoader.RefreshLocale();

    GameManager.instance.localizationManager.onActiveDictionaryChanged +=
      LocaleLoader.RefreshLocale;
  }

  /// <summary>
  /// Refreshes the current locale by identifying the active locale, loading the corresponding
  /// locale dictionary, processing interpolations, and registering the locale dictionary into the
  /// localization manager.
  /// </summary>
  private static void RefreshLocale() {
    var localeId =
      GameManager.instance.localizationManager.activeLocaleId;

    // Check locale wasn't loaded yet.
    if (LocaleLoader.LoadedLocales.Contains(localeId)) {
      return;
    }

    // Mark as loaded right now, so it is not tried again even if it fails.
    LocaleLoader.LoadedLocales.Add(localeId);

    // Load locale dictionary.
    var localeDictionary = LocaleLoader.LoadLocale(localeId);

    // Remove comments and process interpolations in the dictionary.
    var processedLocaleDictionary = LocaleLoader.PostprocessLocaleDictionary(localeDictionary);

    // Manual patches.
    processedLocaleDictionary.Add(
      "Options.OPTION[HallOfFame.HallOfFame.Mod.Settings.LoginStatus]",
      string.Empty);

    // Register the locale dictionary.
    var source = new MemorySource(processedLocaleDictionary);

    GameManager.instance.localizationManager.AddSource(localeId, source);

    Mod.Log.Info($"LocaleLoader: Loaded locale {localeId}.");
  }

  /// <summary>
  /// Loads a locale dictionary for the specified locale identifier by locating the corresponding
  /// JSON resource bundled in the assembly, loading its contents, and parsing them into a
  /// localization dictionary.
  /// </summary>
  private static Dictionary<string, string> LoadLocale(string localeId) {
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

    if (localeDictionary is not null) {
      return localeDictionary;
    }

    Mod.Log.ErrorSilent(
      $"LocaleLoader: Failed to parse resource file {resourceName}.");

    return new Dictionary<string, string>();
  }

  /// <summary>
  /// Processes a given locale dictionary by interpolating references to other dictionary keys
  /// within it and removing comment lines.
  /// Does not modify the source dictionary.
  /// </summary>
  private static Dictionary<string, string> PostprocessLocaleDictionary(
    Dictionary<string, string> dictionary) {
    var gameDictionary = GameManager.instance.localizationManager.activeDictionary;

    var interpolatedDictionary = new Dictionary<string, string>(dictionary);

    foreach (var entry in dictionary) {
      // Remove lines starting with //.
      var value = LocaleLoader.CommentPattern.Replace(entry.Value, string.Empty);

      // Replace {KEY=...} with the value of the key in either the current or game dictionary.
      value = LocaleLoader.InterpolationPattern.Replace(value, match => {
        var key = match.Groups[1].Value;

        return interpolatedDictionary.TryGetValue(key, out var replacement)
          ? replacement
          : gameDictionary.TryGetValue(key, out var gameReplacement)
            ? gameReplacement
            : key;
      });

      interpolatedDictionary[entry.Key] = value;
    }

    return interpolatedDictionary;
  }
}
