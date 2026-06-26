using System.Threading.Tasks;
using HallOfFame.Domain;

namespace HallOfFame.Http;

/// <summary>
/// Seam over the Hall of Fame server API: every network call the mod makes goes through this
/// interface.
/// The production implementation is <see cref="HttpQueries"/>; tests substitute a fake.
/// The framework layer (systems, <see cref="Settings"/>) reaches it via <see cref="Mod.Api"/>,
/// while plain <c>Services/</c> classes receive it through their constructor.
/// </summary>
internal interface IHallOfFameApi {
  Task<Creator> GetMe();

  Task<Creator> UpdateMe();

  Task<CreatorStats> GetCreatorStats();

  #if DEBUG
  /// <summary>
  /// Debug-only: load a specific <see cref="Screenshot"/> by its ID.
  /// </summary>
  Task<Screenshot> GetScreenshot(string screenshotId);
  #endif

  Task<Screenshot> GetRandomScreenshotWeighted();

  Task<View> LikeScreenshot(string screenshotId, bool liked);

  Task<View> MarkScreenshotViewed(string screenshotId);

  Task<Screenshot> ReportScreenshot(string screenshotId);

  Task<Screenshot> UploadScreenshot(UploadScreenshotParams @params);

  Task<byte[]> DownloadImage(string url);

  Task<string> ResolveParadoxModsUsername(string url);
}
