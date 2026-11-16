using System.Text;
using System.Threading.Tasks;
using Colossal.Json;
using HallOfFame.Services;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  public async Task PostErrorReport(ErrorReport report) {
    using var request = new UnityWebRequest(
      HttpQueries.PrependApiUrl("/errors"),
      UnityWebRequest.kHttpVerbPOST
    );

    // A raw body, as UnityWebRequest.Post would form-encode it.
    request.uploadHandler = new UploadHandlerRaw(
      Encoding.UTF8.GetBytes(JSON.Dump(report.ToRequestBody()))
    );

    request.SetRequestHeader("Content-Type", "application/json");

    await HttpQueries.SendForNoContent(request);
  }
}
