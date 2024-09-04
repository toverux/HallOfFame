using System;
using System.Threading.Tasks;
using HallOfFame.Domain;
using UnityEngine;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal static partial class HttpQueries {
    /// <summary>
    /// Upload a screenshot to the Hall of Fame.
    /// </summary>
    internal static async Task<Screenshot> UploadScreenshot(
        string cityName,
        int cityMilestone,
        int cityPopulation,
        byte[] screenshotData,
        ProgressHandler? progressHandler = null) {
        if (string.IsNullOrEmpty(Mod.Settings.CreatorName)) {
            throw new ArgumentNullException(nameof(Mod.Settings.CreatorName));
        }

        var multipart = new WWWForm();

        multipart.AddField("creatorName", Mod.Settings.CreatorName);
        multipart.AddField("cityName", cityName);
        multipart.AddField("cityMilestone", cityMilestone);
        multipart.AddField("cityPopulation", cityPopulation);
        multipart.AddBinaryData("screenshot", screenshotData, "screenshot.jpg");

        using var request = UnityWebRequest.Post(
            HttpQueries.PrependBaseUrl("/api/v1/screenshot/upload"),
            multipart);

        HttpQueries.AddAuthorizationHeader(request);

        await HttpQueries.SendRequest(request, progressHandler);

        return HttpQueries.ParseResponse<Screenshot>(request);
    }
}
