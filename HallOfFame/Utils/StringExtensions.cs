using Colossal.Localization;
using Game.SceneFlow;

namespace HallOfFame.Utils;

internal static class StringExtensions {
    internal static LocalizationDictionary LocalizationDictionary =>
        GameManager.instance.localizationManager.activeDictionary;

    /// <summary>
    /// One-off translation from a key.
    /// If the key is not found in the dictionary, it is returned as is.
    /// </summary>
    internal static string Translate(this string key) {
        return StringExtensions.LocalizationDictionary
            .TryGetValue(key, out var value)
            ? value
            : key;
    }
}
