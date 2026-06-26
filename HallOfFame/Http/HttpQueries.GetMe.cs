using System.Threading.Tasks;
using HallOfFame.Domain;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  public async Task<Creator> GetMe() {
    using var request = UnityWebRequest.Get(HttpQueries.PrependApiUrl("/creators/me"));

    await HttpQueries.SendRequest(request);

    return HttpQueries.ParseResponse<Creator>(request);
  }
}
