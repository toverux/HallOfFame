using System.Threading.Tasks;
using HallOfFame.Domain;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  /// <summary>
  /// Delete one of the authenticated creator's screenshots.
  /// The server answers with the deleted screenshot, which nothing needs.
  /// </summary>
  public async Task DeleteScreenshot(string screenshotId) {
    using var request = UnityWebRequest.Delete(
      HttpQueries.PrependApiUrl($"/screenshots/{screenshotId}")
    );

    await HttpQueries.Send<Screenshot>(request);
  }
}
