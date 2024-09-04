using System.Threading.Tasks;
using HallOfFame.Domain;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal static partial class HttpQueries {
    /// <summary>
    /// Get a random <see cref="Screenshot"/> from the server, with custom
    /// weights for the selection algorithms coming from the mod settings.
    /// </summary>
    internal static async Task<Screenshot> GetRandomScreenshotWeighted() {
        using var request = UnityWebRequest.Get(
            HttpQueries.PrependBaseUrl(
                $"/api/v1/screenshot/weighted" +
                $"?random={Mod.Settings.RandomScreenshotWeight}" +
                $"&recent={Mod.Settings.RecentScreenshotWeight}" +
                $"&archeologist={Mod.Settings.ArcheologistScreenshotWeight}" +
                $"&supporter={Mod.Settings.SupporterScreenshotWeight}" +
                $"&viewMaxAge={Mod.Settings.ViewMaxAge}"));

        HttpQueries.AddAuthorizationHeader(request);

        await HttpQueries.SendRequest(request);

        return HttpQueries.ParseResponse<Screenshot>(request);
    }
}
