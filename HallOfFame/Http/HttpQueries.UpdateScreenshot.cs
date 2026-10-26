using System.Threading.Tasks;
using Colossal.Json;
using HallOfFame.Domain;
using HallOfFame.Services;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  /// <summary>
  /// Update the fields of one of the authenticated creator's screenshots that the update holds.
  /// The answer carries no creator, liked state, or showcased mod.
  /// </summary>
  public async Task<Screenshot> UpdateScreenshot(string screenshotId, ScreenshotUpdate update) {
    using var request = UnityWebRequest.Put(
      HttpQueries.PrependApiUrl($"/screenshots/{screenshotId}"),
      JSON.Dump(update.ToRequestBody())
    );

    request.SetRequestHeader("Content-Type", "application/json");

    return await HttpQueries.Send<Screenshot>(request);
  }
}
