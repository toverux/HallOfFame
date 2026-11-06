using System;
using System.Collections.Generic;
using Colossal.Localization;
using Game.SceneFlow;
using Game.UI.Localization;

namespace HallOfFame.Utils;

internal static class LocalizationExtensions {
  private static LocalizationDictionary LocalizationDictionary =>
    GameManager.instance.localizationManager.activeDictionary;

  extension(string key) {
    /// <summary>
    /// One-off translation from a key.
    /// If the key is not found in the dictionary and a fallback is not provided, the key is
    /// returned as is.
    /// </summary>
    internal string Translate(string? fallback = null) =>
      LocalizationExtensions.LocalizationDictionary
        .TryGetValue(key, out var value)
        ? value
        : fallback ?? key;

    /// <summary>
    /// Same as the single-argument <c>Translate</c> overload but additionally interpolates
    /// <paramref name="args"/> into the resolved string with
    /// <see cref="string.Format(string,object[])"/>.
    /// </summary>
    /// <param name="args">Values to interpolate.</param>
    internal string Translate(params object[] args) => string.Format(key.Translate(), args);
  }

  extension(Exception ex) {
    /// <summary>
    /// Gets a user-friendly message from an exception if the exception type is explicitly supported
    /// in the translation dictionary, that is if there is a
    /// "HallOfFame.Common.ERROR_MESSAGE[Exception.Full.Type.Name]" key.
    /// <br/>
    /// The fallback value is defined to the exception message.
    /// </summary>
    internal LocalizedString GetUserFriendlyMessage() =>
      new(
        $"HallOfFame.Common.ERROR_MESSAGE[{ex.GetType().FullName}]",
        ex.Message,
        new Dictionary<string, ILocElement> {
          ["ERROR_MESSAGE"] = LocalizedString.Value(ex.Message)
        }
      );
  }
}
