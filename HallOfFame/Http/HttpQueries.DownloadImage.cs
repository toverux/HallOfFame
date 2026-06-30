using System.Threading.Tasks;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  public async Task<byte[]> DownloadImage(string url) {
    using var request = UnityWebRequest.Get(url);

    return await HttpQueries.SendForBytes(request);
  }
}
