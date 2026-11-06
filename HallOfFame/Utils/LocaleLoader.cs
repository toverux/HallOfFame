using System;
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
/// The dictionaries are the flat JSON files of <c>Locales/</c>, embedded in the assembly.
/// </summary>
internal static class LocaleLoader {
  internal const string ResourcePrefix = $"{nameof(HallOfFame)}.Locales.";

  private static readonly HashSet<string> LoadedLocales = [];

  /// <seealso cref="PostprocessLocaleDictionary"/>
  private static readonly Regex InterpolationPattern =
    new(@"\{KEY=([^}]+)\}", RegexOptions.Compiled);

  // [ \t] rather than \s, which under Multiline also eats the blank line above a comment.
  /// <seealso cref="PostprocessLocaleDictionary"/>
  private static readonly Regex CommentPattern =
    new(@"^[ \t]*//.*(?:\r?\n)?", RegexOptions.Compiled | RegexOptions.Multiline);

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

  /// <summary>
  /// Loads the JSON resource of the given locale bundled in the assembly and parses it into a
  /// localization dictionary, null when the mod does not ship that locale.
  /// </summary>
  internal static Dictionary<string, string>? ReadDictionary(string localeId) {
    var resourceName = $"{LocaleLoader.ResourcePrefix}{localeId}.json";

    var resourceStream = typeof(LocaleLoader).Assembly.GetManifestResourceStream(resourceName);

    if (resourceStream is null) {
      return null;
    }

    using var reader = new StreamReader(resourceStream, Encoding.UTF8);

    return JSON.MakeInto<Dictionary<string, string>>(JSON.Load(reader.ReadToEnd())) ??
      throw new FormatException($"{resourceName} is not a flat JSON object of strings.");
  }

  /// <summary>
  /// Processes a given locale dictionary by removing comment lines and interpolating references to
  /// other keys within it: <c>{KEY=...}</c> is replaced with the value of that key in the
  /// dictionary, else the string <paramref name="lookupGameString"/> returns for it, else the key.
  /// Does not modify the source dictionary.
  /// </summary>
  internal static Dictionary<string, string> PostprocessLocaleDictionary(
    Dictionary<string, string> dictionary,
    Func<string, string?> lookupGameString
  ) {
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
            : lookupGameString(key) ?? key;
        }
      );

      interpolatedDictionary[entry.Key] = value;
    }

    return interpolatedDictionary;
  }

  private static void RefreshLocale() =>
    LocaleLoader.LoadLocale(GameManager.instance.localizationManager.activeLocaleId);

  /// <summary>
  /// Loads the mod's dictionary for a locale, processes its interpolations, and registers it into
  /// the localization manager.
  /// </summary>
  private static void LoadLocale(string localeId) {
    // Marked as loaded before it is, so a locale that fails is not tried again.
    if (!LocaleLoader.LoadedLocales.Add(localeId)) {
      return;
    }

    Dictionary<string, string>? localeDictionary;
    Dictionary<string, string>? skyveDictionary;

    try {
      localeDictionary = LocaleLoader.ReadDictionary(localeId);

      // Skyve's labels, as Skyve words them, in their own files of the same locale names.
      skyveDictionary = LocaleLoader.ReadDictionary($"Skyve.{localeId}");
    }
    catch (Exception ex) {
      Mod.Log.ErrorSilent(ex, $"{nameof(LocaleLoader)}: Failed to read locale {localeId}.");

      return;
    }

    // Oops, we do not support this one.
    if (localeDictionary is null) {
      Mod.Log.Info($"{nameof(LocaleLoader)}: Skipping locale {localeId}, it is not supported.");

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

    var gameDictionary = GameManager.instance.localizationManager.activeDictionary;

    // Remove comments and process interpolations in the dictionary.
    var processedLocaleDictionary = LocaleLoader.PostprocessLocaleDictionary(
      localeDictionary,
      key => gameDictionary.TryGetValue(key, out var value) ? value : null
    );

    // Skyve's labels go under keys of their own, with no interpolation.
    foreach (var entry in skyveDictionary ?? []) {
      processedLocaleDictionary[$"{nameof(HallOfFame)}.Skyve.{entry.Key}"] = entry.Value;
    }

    // Register the locale dictionary.
    GameManager.instance.localizationManager.AddSource(
      localeId,
      new MemorySource(processedLocaleDictionary)
    );

    Mod.Log.Verbose($"{nameof(LocaleLoader)}: Loaded locale {localeId}.");
  }
}
