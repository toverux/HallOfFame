using System.Collections.Generic;
using System.Threading.Tasks;
using Colossal.UI.Binding;

namespace HallOfFame.Services;

/// <summary>
/// Snapshot of the latest screenshot.
/// Stores the state of the current screenshot and accompanying info that we don't want to update
/// in real-time after the screenshot is taken.
/// Other info like city name and username have their own separated binding as we want to allow the
/// user to change them on the fly after the screenshot is taken.
/// Serializable to JSON for displaying in the UI.
/// The full image encodes after the snapshot is published: a copy made with
/// <see cref="ImageFileSize"/> set marks it ready, keeping the capture's version.
/// </summary>
internal readonly struct ScreenshotSnapshot(
  int achievedMilestone,
  int population,
  string? mapName,
  Task<byte[]> imageBytes,
  int imageWidth,
  int imageHeight,
  bool wasGlobalIlluminationDisabled,
  bool areSettingsTopQuality,
  IDictionary<string, float> renderSettings,
  IReadOnlyDictionary<string, object> renderConditions,
  string[]? modIds
) : IJsonWritable {
  /// <summary>
  /// File name of the screenshot, shared between the on-disk file the capture system writes and the
  /// coui:// URI served to the UI.
  /// The same name is reused for every screenshot, hence the cache-busting version below.
  /// </summary>
  internal const string ScreenshotFileName = "screenshot.jpg";

  /// <summary>
  /// As we use the same file name for each new screenshot, this is a refresh counter appended to
  /// the URL of the image as a query parameter for cache busting.
  /// </summary>
  private static int latestVersion;

  private readonly int currentVersion = ScreenshotSnapshot.latestVersion++;

  internal int AchievedMilestone { get; } = achievedMilestone;

  internal int Population { get; } = population;

  internal string? MapName { get; } = mapName;

  /// <summary>
  /// Completes with the full image encoded as PNG, faulting when its encode failed.
  /// </summary>
  internal Task<byte[]> ImageBytes { get; } = imageBytes;

  /// <summary>
  /// Size in bytes of the full image once its file is written, which the UI then serves, null until
  /// then.
  /// </summary>
  internal int? ImageFileSize { get; init; }

  internal IDictionary<string, float> RenderSettings { get; } =
    renderSettings;

  internal IReadOnlyDictionary<string, object> RenderConditions { get; } = renderConditions;

  /// <summary>
  /// Null when the playset could not be read, which is not the same as a playset with no mod.
  /// </summary>
  internal string[]? ModIds { get; } = modIds;

  /// <summary>
  /// Name of the preview texture, unique to the capture, which the UI loads as the path of
  /// <see cref="PreviewImageUri"/>.
  /// </summary>
  internal string PreviewTextureName => $"/capture-preview-{this.currentVersion}";

  private string PreviewImageUri => $"live://halloffame{this.PreviewTextureName}";

  /// <summary>
  /// Whether this snapshot and <paramref name="other"/> describe the same capture, its full image
  /// ready or not.
  /// </summary>
  internal bool IsSameCapture(ScreenshotSnapshot other) =>
    this.currentVersion == other.currentVersion;

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

    // Written in every state, as cohtml binds one shape per type name.
    writer.PropertyName("isImageReady");
    writer.Write(this.ImageFileSize is not null);

    writer.PropertyName("imageFileSize");
    writer.Write(this.ImageFileSize ?? 0);

    writer.PropertyName("wasGlobalIlluminationDisabled");
    writer.Write(wasGlobalIlluminationDisabled);

    writer.PropertyName("areSettingsTopQuality");
    writer.Write(areSettingsTopQuality);

    writer.TypeEnd();
  }
}
