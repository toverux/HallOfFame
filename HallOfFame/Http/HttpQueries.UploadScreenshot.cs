using System.Collections.Generic;
using System.Threading.Tasks;
using Colossal.Json;
using HallOfFame.Domain;
using UnityEngine;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  /// <summary>
  /// Upload a screenshot to the Hall of Fame.
  /// </summary>
  public async Task<Screenshot> UploadScreenshot(UploadScreenshotParams @params) {
    var multipart = new WWWForm();

    multipart.AddField("cityName", @params.CityName);

    multipart.AddField("cityMilestone", @params.CityMilestone);

    multipart.AddField("cityPopulation", @params.CityPopulation);

    multipart.AddField("shareModIds", @params.ShareModIds ? "true" : "false");

    multipart.AddField("modIds", string.Join(",", @params.ModIds));

    multipart.AddField("shareRenderSettings", @params.ShareRenderSettings ? "true" : "false");

    multipart.AddField("renderSettings", JSON.Dump(@params.RenderSettings));

    multipart.AddField(
      "metadata",
      JSON.Dump(
        new Dictionary<string, string> {
          { "platform", Application.platform.ToString() },
          { "cpu", SystemInfo.processorType },
          { "gpuName", SystemInfo.graphicsDeviceName },
          { "gpuVendor", SystemInfo.graphicsDeviceVendor },
          { "gpuVersion", SystemInfo.graphicsDeviceVersion }
        }
      )
    );

    if (@params.MapName is not null) {
      multipart.AddField("mapName", @params.MapName);
    }

    if (@params.ShowcasedModId is not null) {
      multipart.AddField("showcasedModId", @params.ShowcasedModId);
    }

    if (@params.Description is not null) {
      multipart.AddField("description", @params.Description);
    }

    // This MUST be the last field, I had issues in production if it was not.
    multipart.AddBinaryData("screenshot", @params.ScreenshotData, "screenshot.png");

    using var request = UnityWebRequest.Post(
      HttpQueries.PrependApiUrl("/screenshots"),
      multipart
    );

    await HttpQueries.SendRequest(request, @params.UploadProgressHandler);

    return HttpQueries.ParseResponse<Screenshot>(request);
  }
}
