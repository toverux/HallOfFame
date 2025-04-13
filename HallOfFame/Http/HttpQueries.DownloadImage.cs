using System.Threading.Tasks;
using Game;
using HallOfFame.Utils;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal static partial class HttpQueries {
  internal static async Task<byte[]> DownloadImage(string url) {
    var requestId = (++HttpQueries.lastRequestId).ToString();

    using var request = UnityWebRequest.Get(url);

    await request.SendWebRequest();

    if (request.result is UnityWebRequest.Result.Success) {
      return request.downloadHandler.data;
    }

    Mod.Log.ErrorSilent(
      $"HTTP: Downloading {url} failed ({request.responseCode}): " +
      (string.IsNullOrEmpty(request.downloadHandler.text)
        ? request.error
        : request.downloadHandler.text));

    throw new HttpNetworkException(requestId, request.error);
  }
}
