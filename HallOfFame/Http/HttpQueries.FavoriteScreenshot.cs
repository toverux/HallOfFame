using System.Threading.Tasks;
using HallOfFame.Domain;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal static partial class HttpQueries {
    /// <summary>
    /// Marks the given <see cref="Screenshot"/> as viewed.
    /// </summary>
    internal static async Task<View> FavoriteScreenshot(
        string screenshotId,
        bool favorite) {
        var method = favorite ? "POST" : "DELETE";

        var uri = favorite
            ? $"/screenshots/{screenshotId}/favorites"
            : $"/screenshots/{screenshotId}/favorites/mine";

        using var request = new UnityWebRequest(
            HttpQueries.PrependApiUrl(uri), method);

        await HttpQueries.SendRequest(request);

        return HttpQueries.ParseResponse<View>(request);
    }
}
