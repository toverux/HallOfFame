using System;
using System.Collections.Generic;
using Colossal.Localization;
using Colossal.UI.Binding;
using Game.SceneFlow;
using Game.UI.Localization;

namespace HallOfFame.Utils;

internal static class LocalizationExtensions {
    internal static LocalizationDictionary LocalizationDictionary =>
        GameManager.instance.localizationManager.activeDictionary;

    /// <summary>
    /// One-off translation from a key.
    /// If the key is not found in the dictionary, it is returned as is.
    /// </summary>
    internal static string Translate(this string key) {
        return LocalizationExtensions.LocalizationDictionary
            .TryGetValue(key, out var value)
            ? value
            : key;
    }

    /// <summary>
    /// Same as <see cref="Translate(string)"/> but with variables
    /// interpolation.
    /// </summary>
    /// <param name="key">
    /// A key that points to a string that
    /// <see cref="string.Format(string,object[])"/> can format.
    /// </param>
    /// <param name="args">Values to interpolate</param>
    internal static string Translate(this string key, params object[] args) {
        return string.Format(key.Translate(), args);
    }

    /// <summary>
    /// Gets a user-friendly message from an exception, if the exception type
    /// is explicitly supported in the translation dictionary, that is if there
    /// is a "HallOfFame.Common.ERROR_MESSAGE[Exception.Full.Type.Name]" key.
    /// <br/>
    /// The fallback value is defined to the exception message.
    /// </summary>
    internal static LocalizedString GetUserFriendlyMessage(this Exception ex) {
        return new LocalizedString(
            $"HallOfFame.Common.ERROR_MESSAGE[{ex.GetType().FullName}]",
            ex.Message,
            new Dictionary<string, ILocElement> {
                { "ERROR_MESSAGE", LocalizedString.Value(ex.Message) }
            });
    }
}
