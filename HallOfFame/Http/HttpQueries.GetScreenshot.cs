#if DEBUG
using System.Threading.Tasks;
using HallOfFame.Domain;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal static partial class HttpQueries {
    /// <summary>
    /// Get a specific <see cref="Screenshot"/> by ID from the server.
    /// </summary>
    internal static async Task<Screenshot> GetScreenshot(string screenshotId) {
        using var request = UnityWebRequest.Get(
            HttpQueries.PrependApiUrl($"/screenshots/{screenshotId}"));

        await HttpQueries.SendRequest(request);

        return HttpQueries.ParseResponse<Screenshot>(request);
    }
}
#endif
