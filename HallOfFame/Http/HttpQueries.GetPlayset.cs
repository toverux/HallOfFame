using System.Collections.Generic;
using System.Threading.Tasks;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  /// <summary>
  /// Get the mods of a screenshot's playset, which the server refuses when it is not shared.
  /// </summary>
  public async Task<IReadOnlyList<Domain.Mod>> GetPlayset(string screenshotId) {
    using var request = UnityWebRequest.Get(
      HttpQueries.PrependApiUrl($"/screenshots/{screenshotId}/playset")
    );

    return await HttpQueries.Send<List<Domain.Mod>>(request);
  }
}
