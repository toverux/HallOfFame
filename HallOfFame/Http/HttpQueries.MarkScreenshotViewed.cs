using System.Threading.Tasks;
using HallOfFame.Domain;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal static partial class HttpQueries {
    /// <summary>
    /// Marks the given <see cref="Screenshot"/> as viewed.
    /// </summary>
    internal static async Task<View> MarkScreenshotViewed(string screenshotId) {
        using var request = new UnityWebRequest(
            HttpQueries.PrependApiUrl($"/screenshots/{screenshotId}/views"),
            "POST");

        await HttpQueries.SendRequest(request);

        return HttpQueries.ParseResponse<View>(request);
    }
}
