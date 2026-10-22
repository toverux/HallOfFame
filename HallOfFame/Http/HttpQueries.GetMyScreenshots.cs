using System.Collections.Generic;
using System.Threading.Tasks;
using HallOfFame.Domain;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  /// <summary>
  /// Get the authenticated creator's whole collection, unpaginated,
  /// decoded off the main thread as a collection runs to megabytes.
  /// </summary>
  public async Task<IReadOnlyList<DashboardScreenshot>> GetMyScreenshots() {
    using var request = UnityWebRequest.Get(HttpQueries.PrependApiUrl("/screenshots?creatorId=me"));

    return await HttpQueries.Send<List<DashboardScreenshot>>(
      request,
      isDecodedOffMainThread: true
    );
  }
}
