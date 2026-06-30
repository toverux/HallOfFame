using System.Text.RegularExpressions;

namespace HallOfFame.Http;

/// <summary>
/// Extracts a Paradox Mods username from a creator page URL.
/// The URL is expected to contain an "/authors/&lt;username&gt;" segment (this is where the API
/// redirect lands); anything else yields <c>null</c>.
/// This is a plain, engine-free type, so the extraction can be unit-tested off-engine, separately
/// from the network call in <see cref="HttpQueries.ResolveParadoxModsUsername"/>.
/// </summary>
internal static class CreatorUsernameResolver {
  private static readonly Regex AuthorRegex = new("/authors/(?<author>[^/?#]+)");

  /// <summary>
  /// Returns the username captured from the "/authors/&lt;username&gt;" segment of
  /// <paramref name="url"/>, or <c>null</c> when the URL has no such segment.
  /// </summary>
  internal static string? Resolve(string url) {
    var match = CreatorUsernameResolver.AuthorRegex.Match(url);

    return match.Success
      ? match.Groups["author"].Value
      : null;
  }
}
