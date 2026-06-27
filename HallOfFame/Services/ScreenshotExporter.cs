using System.IO;
using System.Threading.Tasks;
using HallOfFame.Domain;
using HallOfFame.Http;

namespace HallOfFame.Services;

/// <summary>
/// Downloads a community screenshot's 4K image and writes it to disk under a creator/city/date
/// filename.
/// This is the "save another creator's screenshot from the main menu" concern, lifted out of the
/// presenter; it owns no UI state and reports nothing, leaving the saving indicator and error
/// policy to the caller.
/// </summary>
internal sealed class ScreenshotExporter(IHallOfFameApi api) {
  /// <summary>
  /// Downloads the screenshot's 4K image and writes it into <paramref name="directory"/>, returning
  /// the full path of the written file.
  /// Errors (network or I/O) are propagated to the caller.
  /// </summary>
  internal async Task<string> Export(Screenshot screenshot, string directory) {
    var imageBytes = await api.DownloadImage(screenshot.ImageUrl4K);

    var filePath = Path.Combine(
      directory,
      $"{screenshot.Creator?.CreatorName} - " +
      $"{screenshot.CityName} - " +
      $"{screenshot.CreatedAt.ToLocalTime():yyyy.MM.dd HH.mm.ss}.jpg"
    );

    await Task.Run(() => {
        Directory.CreateDirectory(directory);
        File.WriteAllBytes(filePath, imageBytes);
      }
    );

    return filePath;
  }
}
