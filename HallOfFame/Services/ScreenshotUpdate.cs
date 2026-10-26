using System.Collections.Generic;
using Colossal.UI.Binding;

namespace HallOfFame.Services;

/// <summary>
/// The fields of a screenshot the Creator Dashboard's edit form changed, deserialized from the UI,
/// each absent when unchanged, so the server never retranslates a city name it was not sent.
/// </summary>
// ReSharper disable once ClassNeverInstantiated.Global
internal sealed record ScreenshotUpdate : IJsonReadable {
  internal string? CityName;

  internal string? Description;

  /// <summary>
  /// The Paradox Mods ID of the mod now showcased, empty to clear it,
  /// as an empty <see cref="Description"/> clears the description.
  /// </summary>
  internal string? ShowcasedModId;

  internal bool? ShareParadoxModIds;

  internal bool? ShareRenderSettings;

  /// <summary>
  /// The request body, holding only the changed fields.
  /// </summary>
  internal Dictionary<string, object> ToRequestBody() {
    var body = new Dictionary<string, object>();

    if (this.CityName is not null) {
      body["cityName"] = this.CityName;
    }

    if (this.Description is not null) {
      body["description"] = this.Description;
    }

    if (this.ShowcasedModId is not null) {
      body["showcasedModId"] = this.ShowcasedModId;
    }

    if (this.ShareParadoxModIds is {} shareParadoxModIds) {
      body["shareParadoxModIds"] = shareParadoxModIds;
    }

    if (this.ShareRenderSettings is {} shareRenderSettings) {
      body["shareRenderSettings"] = shareRenderSettings;
    }

    return body;
  }

  public void Read(IJsonReader reader) {
    reader.ReadMapBegin();

    if (reader.ReadProperty("cityName")) {
      reader.Read(out string cityName);
      this.CityName = cityName;
    }

    if (reader.ReadProperty("description")) {
      reader.Read(out string description);
      this.Description = description;
    }

    if (reader.ReadProperty("showcasedModId")) {
      reader.Read(out string showcasedModId);
      this.ShowcasedModId = showcasedModId;
    }

    if (reader.ReadProperty("shareParadoxModIds")) {
      reader.Read(out bool shareParadoxModIds);
      this.ShareParadoxModIds = shareParadoxModIds;
    }

    if (reader.ReadProperty("shareRenderSettings")) {
      reader.Read(out bool shareRenderSettings);
      this.ShareRenderSettings = shareRenderSettings;
    }

    reader.ReadMapEnd();
  }
}
