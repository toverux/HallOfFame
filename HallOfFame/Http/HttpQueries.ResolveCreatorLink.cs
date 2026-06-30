using System.Threading.Tasks;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  /// <summary>
  /// Gets the given URL, which is expected to be an API URL link to a creator's Paradox Mods page
  /// (ex. https://halloffame.cs2.mtq.io/api/v1/creators/toverux/social/paradoxMods), and returns
  /// the Paradox Mods username.
  /// </summary>
  public async Task<string> ResolveParadoxModsUsername(string url) {
    using var request = UnityWebRequest.Head(url);

    // We should have been redirected to the Paradox Mods URL.
    var pdxUrl = await HttpQueries.SendForRedirect(request);

    var username = CreatorUsernameResolver.Resolve(pdxUrl);

    if (username is null) {
      throw new HttpNetworkException(
        HttpQueries.GetRequestId(request),
        $"Error resolving link to creator page: Could not extract username from {pdxUrl}."
      );
    }

    return username;
  }
}
