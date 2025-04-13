using System.Collections.Generic;
using System.Threading.Tasks;
using Colossal.Json;
using HallOfFame.Domain;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal static partial class HttpQueries {
  internal static async Task<Creator> UpdateMe() {
    var payload = new Dictionary<string, object> {
      { "modSettings", Mod.Settings }
    };

    using var request = UnityWebRequest.Put(
      HttpQueries.PrependApiUrl("/creators/me"),
      JSON.Dump(payload));

    request.SetRequestHeader("Content-Type", "application/json");

    await HttpQueries.SendRequest(request);

    return HttpQueries.ParseResponse<Creator>(request);
  }
}
