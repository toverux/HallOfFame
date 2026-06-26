using System.Collections.Generic;
using System.Threading.Tasks;
using Colossal.Json;
using Game.SceneFlow;
using Game.Settings;
using HallOfFame.Domain;
using UnityEngine;
using UnityEngine.Networking;

namespace HallOfFame.Http;

internal partial class HttpQueries {
  public async Task<Creator> UpdateMe() {
    var payload = new Dictionary<string, object> {
      { "locale", GameManager.instance.localizationManager.activeLocaleId },
      // Free-form object we can use for debugging/analytics.
      {
        "metadata", new Dictionary<string, object> {
          // General info
          { "modVersion", typeof(HttpQueries).Assembly.GetName().Version.ToString(3) },
          { "isNvidiaGpu", Settings.IsNvidiaGpu() },
          { "screenWidth", Screen.width },
          { "screenHeight", Screen.height },
          { "useLegacyInterface", SharedSettings.instance.userInterface.useLegacyInterface },
          // Some mod settings
          { "enableMainMenuSlideshow", Mod.Settings.EnableMainMenuSlideshow },
          { "enableLoadingScreenBackground", Mod.Settings.EnableLoadingScreenBackground },
          { "showFeaturedAsset", Mod.Settings.ShowFeaturedAsset },
          { "showCreatorSocials", Mod.Settings.ShowCreatorSocials },
          { "showViewCount", Mod.Settings.ShowViewCount },
          { "namesTranslationMode", Mod.Settings.NamesTranslationMode },
          { "popularScreenshotWeight", Mod.Settings.PopularScreenshotWeight },
          { "trendingScreenshotWeight", Mod.Settings.TrendingScreenshotWeight },
          { "recentScreenshotWeight", Mod.Settings.RecentScreenshotWeight },
          { "archeologistScreenshotWeight", Mod.Settings.ArcheologistScreenshotWeight },
          { "randomScreenshotWeight", Mod.Settings.RandomScreenshotWeight },
          { "supporterScreenshotWeight", Mod.Settings.SupporterScreenshotWeight },
          { "viewMaxAge", Mod.Settings.ViewMaxAge },
          { "screenshotResolution", Mod.Settings.ScreenshotResolution },
          { "createLocalScreenshot", Mod.Settings.CreateLocalScreenshot },
          { "disableGlobalIllumination", Mod.Settings.DisableGlobalIllumination },
          { "paradoxModsBrowsingPreference", Mod.Settings.ParadoxModsBrowsingPreference },
        }
      }
    };

    using var request = UnityWebRequest.Put(
      HttpQueries.PrependApiUrl("/creators/me"),
      JSON.Dump(payload)
    );

    request.SetRequestHeader("Content-Type", "application/json");

    await HttpQueries.SendRequest(request);

    return HttpQueries.ParseResponse<Creator>(request);
  }
}
