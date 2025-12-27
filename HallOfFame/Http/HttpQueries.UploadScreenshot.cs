using System.Collections.Generic;
using System.Threading.Tasks;
using Colossal.Json;
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
    string? mapName,
    IEnumerable<int> modIds,
    IDictionary<string, float> renderSettings,
    byte[] screenshotData,
    ProgressHandler? progressHandler = null
  ) {
    var metadata = new Dictionary<string, string> {
      { "platform", Application.platform.ToString() },
      { "cpu", SystemInfo.processorType },
      { "gpuName", SystemInfo.graphicsDeviceName },
      { "gpuVendor", SystemInfo.graphicsDeviceVendor },
      { "gpuVersion", SystemInfo.graphicsDeviceVersion }
    };

    var multipart = new WWWForm();

    multipart.AddField("cityName", cityName);
    multipart.AddField("cityMilestone", cityMilestone);
    multipart.AddField("cityPopulation", cityPopulation);

    if (mapName is not null) {
      multipart.AddField("mapName", mapName);
    }

    multipart.AddField("modIds", string.Join(",", modIds));
    multipart.AddField("renderSettings", JSON.Dump(renderSettings));
    multipart.AddField("metadata", JSON.Dump(metadata));

    multipart.AddBinaryData("screenshot", screenshotData, "screenshot.png");

    using var request = UnityWebRequest.Post(
      HttpQueries.PrependApiUrl("/screenshots"),
      multipart
    );

    await HttpQueries.SendRequest(request, progressHandler);

    return HttpQueries.ParseResponse<Screenshot>(request);
  }
}
