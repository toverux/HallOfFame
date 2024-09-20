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
        var multipart = new WWWForm();

        multipart.AddField("cityName", cityName);
        multipart.AddField("cityMilestone", cityMilestone);
        multipart.AddField("cityPopulation", cityPopulation);
        multipart.AddBinaryData("screenshot", screenshotData, "screenshot.jpg");

        using var request = UnityWebRequest.Post(
            HttpQueries.PrependApiUrl("/screenshots"),
            multipart);

        await HttpQueries.SendRequest(request, progressHandler);

        return HttpQueries.ParseResponse<Screenshot>(request);
    }
}
