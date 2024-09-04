using System.Collections.Generic;
using System.Threading.Tasks;
using Colossal.Json;
using HallOfFame.Domain;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal static partial class HttpQueries {
    /// <summary>
    /// Report a screenshot to the moderation team.
    /// </summary>
    internal static async Task<Screenshot>
        ReportScreenshot(string screenshotId) {
        var payload = JSON.Dump(new Dictionary<string, object> {
            { "screenshotId", screenshotId }
        });

        using var request = UnityWebRequest.Post(
            HttpQueries.PrependBaseUrl("/api/v1/screenshot/report"),
            payload,
            "application/json");

        await HttpQueries.SendRequest(request);

        return HttpQueries.ParseResponse<Screenshot>(request);
    }
}
