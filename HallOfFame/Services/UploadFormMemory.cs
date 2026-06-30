using Colossal.UI.Binding;

namespace HallOfFame.Services;

/// <summary>
/// The latest values the user used in the screenshot upload panel, restored when the panel reopens.
/// The persisted source of truth lives in the hidden <c>Saved*</c> properties of
/// <see cref="Settings"/>; this struct is only the upload-feature-owned, self-serializing view of
/// them exposed to the UI through the <c>hallOfFame.capture</c> binding group.
/// </summary>
internal readonly struct UploadFormMemory(
  bool shareModIds,
  bool shareRenderSettings,
  string? description
) : IJsonWritable {
  public void Write(IJsonWriter writer) {
    writer.TypeBegin(this.GetType().FullName);

    writer.PropertyName("shareModIds");
    writer.Write(shareModIds);

    writer.PropertyName("shareRenderSettings");
    writer.Write(shareRenderSettings);

    writer.PropertyName("description");
    writer.Write(description);

    writer.TypeEnd();
  }
}
