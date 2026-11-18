using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using HallOfFame.Logging;
using HallOfFame.Utils;
using Xunit;

namespace HallOfFame.Tests.Utils;

public sealed class LocaleLoaderTests {
  private static readonly Dictionary<string, string> GameDictionary = new() {
    ["Game.CITY"] = "City"
  };

  [Fact]
  public void Postprocess_RemovesCommentLines() {
    var processed = LocaleLoaderTests.Postprocess(
      new Dictionary<string, string> {
        ["Key"] = "// A note for translators.\nFirst line\n  // Indented note.\nSecond line"
      }
    );

    Assert.Equal("First line\nSecond line", processed["Key"]);
  }

  [Fact]
  public void Postprocess_KeepsTheBlankLineAboveAComment() {
    var processed = LocaleLoaderTests.Postprocess(
      new Dictionary<string, string> {
        ["Key"] = "First paragraph.\n\n// A note for translators.\nSecond paragraph."
      }
    );

    Assert.Equal("First paragraph.\n\nSecond paragraph.", processed["Key"]);
  }

  [Fact]
  public void Postprocess_KeepsSlashesInsideALine() {
    var processed = LocaleLoaderTests.Postprocess(
      new Dictionary<string, string> {
        ["Key"] = "See https://example.com // not a comment"
      }
    );

    Assert.Equal("See https://example.com // not a comment", processed["Key"]);
  }

  [Fact]
  public void Postprocess_InterpolatesAKeyOfTheModDictionary() {
    var processed = LocaleLoaderTests.Postprocess(
      new Dictionary<string, string> {
        ["Mod.NAME"] = "My Mod",
        ["Mod.TITLE"] = "Welcome to {KEY=Mod.NAME}!"
      }
    );

    Assert.Equal("Welcome to My Mod!", processed["Mod.TITLE"]);
  }

  [Fact]
  public void Postprocess_FallsBackToTheGameDictionary() {
    var processed = LocaleLoaderTests.Postprocess(
      new Dictionary<string, string> {
        ["Key"] = "Your {KEY=Game.CITY}"
      }
    );

    Assert.Equal("Your City", processed["Key"]);
  }

  [Fact]
  public void Postprocess_LeavesAnUnknownKeyAsIs() {
    var processed = LocaleLoaderTests.Postprocess(
      new Dictionary<string, string> {
        ["Key"] = "Missing {KEY=Nowhere.KEY}"
      }
    );

    Assert.Equal("Missing Nowhere.KEY", processed["Key"]);
  }

  [Fact]
  public void Postprocess_LeavesTheSourceDictionaryUntouched() {
    var source = new Dictionary<string, string> {
      ["Key"] = "// Note.\n{KEY=Game.CITY}"
    };

    LocaleLoaderTests.Postprocess(source);

    Assert.Equal("// Note.\n{KEY=Game.CITY}", source["Key"]);
  }

  [Fact]
  public void ReadDictionary_ReturnsNullForALocaleTheModDoesNotShip() =>
    Assert.Null(LocaleLoader.ReadDictionary("xx-XX"));

  /// <summary>
  /// Every embedded locale file parses as a flat JSON object of strings, and the source locale
  /// holds the strings the error messages are built from.
  /// </summary>
  [Fact]
  public void ReadDictionary_ParsesEveryShippedLocale() {
    var localeIds = typeof(LocaleLoader)
      .Assembly
      .GetManifestResourceNames()
      .Where(static name => name.StartsWith(LocaleLoader.ResourcePrefix) && name.EndsWith(".json"))
      .Select(static name => name[LocaleLoader.ResourcePrefix.Length..^".json".Length])
      .ToList();

    Assert.Contains("en-US", localeIds);

    // ReadDictionary returns null only for a locale the assembly does not embed, and each of these
    // ids comes from an embedded resource, en-US included.
    Assert.All(
      localeIds,
      static localeId => Assert.NotEmpty(LocaleLoader.ReadDictionary(localeId)!)
    );

    Assert.Contains(ModLog.BaseErrorKey, LocaleLoader.ReadDictionary("en-US")!.Keys);
  }

  [Fact]
  public void AddAliases_CopiesTheSourceStringUnderTheAlias() {
    var dictionary = new Dictionary<string, string> {
      ["Label"] = "Open"
    };

    LocaleLoader.AddAliases(dictionary, [("Title", "Label")]);

    Assert.Equal("Open", dictionary["Title"]);
  }

  [Fact]
  public void AddAliases_LeavesAnAliasWhoseSourceTheLocaleLacksToTheFallbackLocale() {
    var dictionary = new Dictionary<string, string>();

    LocaleLoader.AddAliases(dictionary, [("Title", "Label")]);

    Assert.Empty(dictionary);
  }

  /// <summary>
  /// The game's rebinding dialog titles a binding with <c>Options.OPTION[&lt;title&gt;]</c> and
  /// names its mod with <c>Options.INPUT_MAP[&lt;map&gt;]</c>, the keys
  /// <see cref="LocaleLoader.ListAliases"/> fills.
  /// </summary>
  [Fact]
  public void TheGamesRebindingDialog_ReadsTheKeysTheAliasesFill() {
    var bundle = GameInstall.ReadUIBundle();

    Assert.True(
      Regex.IsMatch(bundle, @"`Options\.OPTION\[\$\{[\w$]+\.title\}\]`") &&
      Regex.IsMatch(bundle, @"Options\.INPUT_MAP,\{hash:[\w$]+\.optionGroup\b"),
      "The game's rebinding dialog reads other keys since a game update, and shows the raw " +
      "keys of the mod's bindings: find the keys its title and its conflict list read in the " +
      "game's UI bundle, make LocaleLoader.ListAliases fill those, and update this test."
    );
  }

  private static Dictionary<string, string> Postprocess(Dictionary<string, string> dictionary) =>
    LocaleLoader.PostprocessLocaleDictionary(
      dictionary,
      static key => LocaleLoaderTests.GameDictionary.GetValueOrDefault(key)
    );
}
