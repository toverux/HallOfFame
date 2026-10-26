using System.Collections.Generic;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Services;

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

  /// <summary>
  /// One screenshot by its ID, reported or not, with its showcased mod,
  /// and whether the authenticated creator likes it.
  /// </summary>
  Task<Screenshot> GetScreenshot(string screenshotId);

  Task<Screenshot> GetRandomScreenshotWeighted();

  /// <summary>
  /// Every screenshot the authenticated creator uploaded, reported ones included, in no particular
  /// order, as the dashboard's slim record.
  /// </summary>
  Task<IReadOnlyList<DashboardScreenshot>> GetMyScreenshots();

  Task<View> LikeScreenshot(string screenshotId, bool liked);

  Task<View> MarkScreenshotViewed(string screenshotId);

  Task<Screenshot> ReportScreenshot(string screenshotId);

  /// <summary>
  /// Changes the fields of one of the authenticated creator's screenshots that the update holds,
  /// answering with the screenshot without its creator, liked state, or showcased mod.
  /// </summary>
  Task<Screenshot> UpdateScreenshot(string screenshotId, ScreenshotUpdate update);

  /// <summary>
  /// Deletes one of the authenticated creator's screenshots for good.
  /// </summary>
  Task DeleteScreenshot(string screenshotId);

  /// <summary>
  /// The mods of a screenshot's shared playset, most subscribed first, those Paradox Mods no
  /// longer publishes listed last with their <see cref="Domain.Mod.State"/>.
  /// Mods Paradox Mods deleted or banned, or the server failed to fetch, are left out.
  /// </summary>
  Task<IReadOnlyList<Domain.Mod>> GetPlayset(string screenshotId);

  Task<Screenshot> UploadScreenshot(UploadScreenshotParams @params);

  Task<byte[]> DownloadImage(string url);

  Task<string> ResolveParadoxModsUsername(string url);
}
