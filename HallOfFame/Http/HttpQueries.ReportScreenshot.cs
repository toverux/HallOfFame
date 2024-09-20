using System.Threading.Tasks;
using HallOfFame.Domain;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal static partial class HttpQueries {
    /// <summary>
    /// Report a screenshot to the moderation team.
    /// </summary>
    internal static async Task<Screenshot>
        ReportScreenshot(string screenshotId) {
        using var request = new UnityWebRequest(
            HttpQueries.PrependApiUrl($"/screenshots/{screenshotId}/reports"),
            "POST");

        await HttpQueries.SendRequest(request);

        return HttpQueries.ParseResponse<Screenshot>(request);
    }
}
