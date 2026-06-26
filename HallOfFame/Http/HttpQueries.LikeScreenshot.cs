using System.Threading.Tasks;
using HallOfFame.Domain;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  /// <summary>
  /// Marks the given <see cref="Screenshot"/> as liked.
  /// </summary>
  public async Task<View> LikeScreenshot(
    string screenshotId,
    bool liked
  ) {
    var method = liked ? "POST" : "DELETE";

    var uri = liked
      ? $"/screenshots/{screenshotId}/favorites"
      : $"/screenshots/{screenshotId}/favorites/mine";

    using var request = new UnityWebRequest(HttpQueries.PrependApiUrl(uri), method);

    await HttpQueries.SendRequest(request);

    return HttpQueries.ParseResponse<View>(request);
  }
}
