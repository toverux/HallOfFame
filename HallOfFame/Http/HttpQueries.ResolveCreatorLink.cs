using System;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal static partial class HttpQueries {
  /// <summary>
  /// Gets the given URL, which is expected to be an API URL link to a creator's Paradox Mods page
  /// (ex. https://halloffame.cs2.mtq.io/api/v1/creators/toverux/social/paradoxMods), and returns
  /// the Paradox Mods username.
  /// </summary>
  internal static async Task<string> ResolveParadoxModsUsername(string url) {
    using var request = UnityWebRequest.Head(url);

    await HttpQueries.SendRequest(request);

    if (request.result is not UnityWebRequest.Result.Success) {
      throw new Exception(
        $"Error resolving link to creator page: {request.responseCode} {request.error}."
      );
    }

    // We should have been redirected to the Paradox Mods URL.
    var pdxUrl = request.url;

    var username = Regex.Match(pdxUrl, "/authors/(?<author>[^/?#]+)").Groups["author"]?.Value;

    if (username is null) {
      throw new Exception(
        $"Error resolving link to creator page: Could not extract username from {pdxUrl}."
      );
    }

    return username;
  }
}
