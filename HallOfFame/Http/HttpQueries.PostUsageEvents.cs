using System.Text;
using System.Threading.Tasks;
using Colossal.Json;
using HallOfFame.Services;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  public async Task PostUsageEvents(UsageBatch batch) {
    using var request = new UnityWebRequest(
      HttpQueries.PrependApiUrl("/usage/events"),
      UnityWebRequest.kHttpVerbPOST
    );

    // A raw body, as UnityWebRequest.Post would form-encode it.
    request.uploadHandler = new UploadHandlerRaw(
      Encoding.UTF8.GetBytes(JSON.Dump(batch.ToRequestBody()))
    );

    request.SetRequestHeader("Content-Type", "application/json");

    await HttpQueries.SendForNoContent(request);
  }
}
