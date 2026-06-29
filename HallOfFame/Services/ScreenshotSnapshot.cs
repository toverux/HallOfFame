using System.Collections.Generic;
using Colossal.UI.Binding;

namespace HallOfFame.Services;

/// <summary>
/// Snapshot of the latest screenshot.
/// Stores the state of the current screenshot and accompanying info that we don't want to update
/// in real-time after the screenshot is taken.
/// Other info like city name and username have their own separated binding as we want to allow the
/// user to change them on the fly after the screenshot is taken.
/// Serializable to JSON for displaying in the UI.
/// </summary>
internal readonly struct ScreenshotSnapshot(
  int achievedMilestone,
  int population,
  string? mapName,
  byte[] imageBytes,
  int imageWidth,
  int imageHeight,
  bool wasGlobalIlluminationDisabled,
  bool areSettingsTopQuality,
  IDictionary<string, float> renderSettings,
  string[] modIds
) : IJsonWritable {
  /// <summary>
  /// File name of the screenshot, shared between the on-disk file the capture system writes and the
  /// coui:// URI served to the UI.
  /// The same name is reused for every screenshot, hence the cache-busting version below.
  /// </summary>
  internal const string ScreenshotFileName = "screenshot.jpg";

  /// <summary>
  /// File name of the screenshot preview.
  /// See <see cref="ScreenshotFileName"/>.
  /// </summary>
  internal const string ScreenshotPreviewFileName = "preview.jpg";

  /// <summary>
  /// As we use the same file name for each new screenshot, this is a refresh counter appended to
  /// the URL of the image as a query parameter for cache busting.
  /// </summary>
  private static int latestVersion;

  private readonly int currentVersion = ScreenshotSnapshot.latestVersion++;

  internal int AchievedMilestone { get; } = achievedMilestone;

  internal int Population { get; } = population;

  internal string? MapName { get; } = mapName;

  internal byte[] ImageBytes { get; } = imageBytes;

  internal IDictionary<string, float> RenderSettings { get; } =
    renderSettings;

  internal string[] ModIds { get; } = modIds;

  internal string PreviewImageUri =>
    $"coui://halloffame/{ScreenshotSnapshot.ScreenshotPreviewFileName}" +
    $"?v={this.currentVersion}";

  private string ImageUri =>
    $"coui://halloffame/{ScreenshotSnapshot.ScreenshotFileName}" +
    $"?v={this.currentVersion}";

  public void Write(IJsonWriter writer) {
    writer.TypeBegin(this.GetType().FullName);

    writer.PropertyName("mapName");
    writer.Write(this.MapName);

    writer.PropertyName("achievedMilestone");
    writer.Write(this.AchievedMilestone);

    writer.PropertyName("population");
    writer.Write(this.Population);

    writer.PropertyName("previewImageUri");
    writer.Write(this.PreviewImageUri);

    writer.PropertyName("imageUri");
    writer.Write(this.ImageUri);

    writer.PropertyName("imageWidth");
    writer.Write(imageWidth);

    writer.PropertyName("imageHeight");
    writer.Write(imageHeight);

    writer.PropertyName("imageFileSize");
    writer.Write(this.ImageBytes.Length);

    writer.PropertyName("wasGlobalIlluminationDisabled");
    writer.Write(wasGlobalIlluminationDisabled);

    writer.PropertyName("areSettingsTopQuality");
    writer.Write(areSettingsTopQuality);

    writer.TypeEnd();
  }
}
