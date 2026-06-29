using Colossal.UI.Binding;
using ValueType = cohtml.Net.ValueType;

namespace HallOfFame.Services;

/// <summary>
/// User-provided info accompanying a screenshot upload, deserialized from the UI upload form.
/// Unlike <see cref="ScreenshotSnapshot"/>, which freezes the capture-time state, these fields can
/// be edited on the fly after the screenshot is taken.
/// </summary>
// ReSharper disable once ClassNeverInstantiated.Global
internal sealed record ScreenshotInfoFormValue : IJsonReadable {
  internal bool ShareModIds;

  internal bool ShareRenderSettings;

  internal string? ShowcasedModId;

  internal string? Description;

  public void Read(IJsonReader reader) {
    reader.ReadMapBegin();

    reader.ReadProperty("shareModIds");
    reader.Read(out this.ShareModIds);

    reader.ReadProperty("shareRenderSettings");
    reader.Read(out this.ShareRenderSettings);

    reader.ReadProperty("showcasedModId");

    var showcasedModIdValueType = reader.PeekValueType();

    if (showcasedModIdValueType is ValueType.Null) {
      reader.SkipValue();
    }
    else {
      reader.Read(out string showcasedModId);
      this.ShowcasedModId = showcasedModId;
    }

    reader.ReadProperty("description");
    reader.Read(out this.Description);

    reader.ReadMapEnd();
  }
}
