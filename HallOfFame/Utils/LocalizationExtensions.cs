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
    /// If the key is not found in the dictionary and a fallback is not provided, the key is returned
    /// as is.
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
    internal string Translate(params object[] args) =>
      string.Format(key.Translate(), args);
  }

  extension(Exception ex) {
    /// <summary>
    /// Gets a user-friendly message from an exception if the exception type is explicitly supported
    /// in the translation dictionary, that is if there is a
    /// "HallOfFame.Common.ERROR_MESSAGE[Exception.Full.Type.Name]" key.
    /// <br/>
    /// The fallback value is defined to the exception message.
    /// </summary>
    internal LocalizedString GetUserFriendlyMessage() => new(
      $"HallOfFame.Common.ERROR_MESSAGE[{ex.GetType().FullName}]",
      ex.Message,
      new Dictionary<string, ILocElement> { { "ERROR_MESSAGE", LocalizedString.Value(ex.Message) } }
    );
  }

  extension(LocalizedString) {
    /// <summary>
    /// Builds a <see cref="LocalizedString"/> from a translation <paramref name="id"/> and its
    /// named <paramref name="substitutions"/>, an off-engine-safe stand-in for the game's overload
    /// <c>LocalizedString.Id(string, params (string, ILocElement)[])</c>.
    /// <para>
    /// That overload fills its args dictionary through the
    /// <c>Dictionary(IEnumerable&lt;KeyValuePair&gt;)</c> constructor, which the net48 BCL the
    /// off-engine tests run against does not have, so calling it there throws
    /// <see cref="MissingMethodException"/>. This helper assembles the same value using only APIs
    /// available on net48.
    /// </para>
    /// </summary>
    internal static LocalizedString IdWithArgs(
      string id,
      params (string key, ILocElement value)[] substitutions
    ) {
      if (substitutions.Length is 0) {
        return LocalizedString.Id(id);
      }

      var args = new Dictionary<string, ILocElement>(substitutions.Length);

      foreach (var (key, value) in substitutions) {
        args[key] = value;
      }

      return new LocalizedString(id, value: null, args);
    }
  }

  extension(LocalizedString localizedString) {
    /// <summary>
    /// <para>
    /// Renders a <see cref="LocalizedString"/> to plain display text using the active localization
    /// dictionary.
    /// </para>
    /// <para>
    /// The <see cref="LocalizedString.id"/> is looked up in the dictionary and its named
    /// placeholders (<c>{KEY}</c>) are replaced with the rendered <see cref="LocalizedString.args"/>;
    /// when the id is absent the literal <see cref="LocalizedString.value"/> is used, falling back to
    /// the id itself.
    /// </para>
    /// </summary>
    internal string Render() {
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
}
