using System;
using System.Collections.Generic;
using Colossal.Localization;
using Game.SceneFlow;
using Game.UI.Localization;

namespace HallOfFame.Utils;

internal static class LocalizationExtensions {
  private static LocalizationDictionary LocalizationDictionary =>
    GameManager.instance.localizationManager.activeDictionary;

  /// <summary>
  /// One-off translation from a key.
  /// If the key is not found in the dictionary and a fallback is not provided, the key is returned
  /// as is.
  /// </summary>
  internal static string Translate(this string key, string? fallback = null) =>
    LocalizationExtensions.LocalizationDictionary
      .TryGetValue(key, out var value)
      ? value
      : fallback ?? key;

  /// <summary>
  /// Same as <see cref="Translate(string, string?)"/> but with variable interpolation.
  /// </summary>
  /// <param name="key">
  /// A key that points to a string that <see cref="string.Format(string,object[])"/> can format.
  /// </param>
  /// <param name="args">Values to interpolate</param>
  internal static string Translate(this string key, params object[] args) =>
    string.Format(key.Translate(), args);

  /// <summary>
  /// Gets a user-friendly message from an exception if the exception type is explicitly supported
  /// in the translation dictionary, that is if there is a
  /// "HallOfFame.Common.ERROR_MESSAGE[Exception.Full.Type.Name]" key.
  /// <br/>
  /// The fallback value is defined to the exception message.
  /// </summary>
  internal static LocalizedString GetUserFriendlyMessage(this Exception ex) => new(
    $"HallOfFame.Common.ERROR_MESSAGE[{ex.GetType().FullName}]",
    ex.Message,
    new Dictionary<string, ILocElement> { { "ERROR_MESSAGE", LocalizedString.Value(ex.Message) } }
  );

  /// <summary>
  /// <para>
  /// Renders a <see cref="LocalizedString"/> to plain display text using the active localization
  /// dictionary.
  /// </para>
  /// <para>
  /// The <see cref="LocalizedString.id"/> is looked up in the dictionary and its named placeholders
  /// (<c>{KEY}</c>) are replaced with the rendered <see cref="LocalizedString.args"/>; when the id
  /// is absent the literal <see cref="LocalizedString.value"/> is used, falling back to the id
  /// itself.
  /// </para>
  /// </summary>
  internal static string Render(this LocalizedString localizedString) {
    var template =
      localizedString.id is not null &&
      LocalizationExtensions.LocalizationDictionary.TryGetValue(localizedString.id, out var value)
        ? value
        : localizedString.value ?? localizedString.id ?? string.Empty;

    if (localizedString.args is null) {
      return template;
    }

    foreach (var arg in localizedString.args) {
      var rendered = arg.Value is LocalizedString nested
        ? nested.Render()
        : arg.Value?.ToString() ?? string.Empty;

      template = template.Replace($"{{{arg.Key}}}", rendered);
    }

    return template;
  }
}
