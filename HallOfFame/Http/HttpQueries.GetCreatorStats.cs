using System.Threading.Tasks;
using HallOfFame.Domain;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  public async Task<CreatorStats> GetCreatorStats() {
    using var request = UnityWebRequest.Get(HttpQueries.PrependApiUrl("/creators/me/stats"));

    await HttpQueries.SendRequest(request);

    return HttpQueries.ParseResponse<CreatorStats>(request);
  }
}
