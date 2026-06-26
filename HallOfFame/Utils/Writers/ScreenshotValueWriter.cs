using Colossal.UI.Binding;
using HallOfFame.Domain;

namespace HallOfFame.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for <see cref="Screenshot"/>.
/// </summary>
/// <remarks>
/// These writers are unit-testable via a recording <c>IJsonWriter</c> fake if a regression ever
/// justifies building one.
/// </remarks>
internal sealed class ScreenshotValueWriter : IWriter<Screenshot?> {
  private static readonly CreatorValueWriter creatorWriter = new();

  private static readonly ModValueWriter showcasedModWriter = new();

  public void Write(IJsonWriter writer, Screenshot? value) {
    // The binding holds the current screenshot, which is null when none is being presented.
    if (value is null) {
      writer.WriteNull();

      return;
    }

    // cohtml caches a model's shape by type name and does not support polymorphism: two payloads
    // sharing a type name must expose the same set of *present* properties. Omitting a property
    // (e.g. dropping "creator" when there is none) changes the shape, so each optional sub-object's
    // presence is encoded into the type name. Presence is what matters, not value: a property that
    // is present but null keeps the same shape, so nullity alone never needs a distinct type name.
    writer.TypeBegin(
      $"{typeof(Screenshot).FullName}" +
      $"?Creator={value.Creator is not null}" +
      $"&ShowcasedMod={value.ShowcasedMod is not null}"
    );

    writer.PropertyName("id");
    writer.Write(value.Id);

    writer.PropertyName("cityName");
    writer.Write(value.CityName);

    writer.PropertyName("cityNameLocale");
    writer.Write(value.CityNameLocale);

    writer.PropertyName("cityNameLatinized");
    writer.Write(value.CityNameLatinized);

    writer.PropertyName("cityNameTranslated");
    writer.Write(value.CityNameTranslated);

    writer.PropertyName("cityMilestone");
    writer.Write(value.CityMilestone);

    writer.PropertyName("cityPopulation");
    writer.Write(value.CityPopulation);

    writer.PropertyName("mapName");
    writer.Write(value.MapName);

    writer.PropertyName("description");
    writer.Write(value.Description);

    writer.PropertyName("imageUrlFHD");
    writer.Write(value.ImageUrlFHD);

    writer.PropertyName("imageUrl4K");
    writer.Write(value.ImageUrl4K);

    writer.PropertyName("shareRenderSettings");
    writer.Write(value.ShareRenderSettings);

    writer.PropertyName("renderSettings");
    writer.Write(value.RenderSettings);

    writer.PropertyName("createdAt");
    writer.Write(value.CreatedAt.ToLocalTime().ToString("o"));

    writer.PropertyName("createdAtFormatted");
    writer.Write(value.CreatedAtFormatted);

    writer.PropertyName("createdAtFormattedDistance");
    writer.Write(value.CreatedAtFormattedDistance);

    writer.PropertyName("likesCount");
    writer.Write(value.LikesCount);

    writer.PropertyName("viewsCount");
    writer.Write(value.ViewsCount);

    writer.PropertyName("uniqueViewsCount");
    writer.Write(value.UniqueViewsCount);

    writer.PropertyName("likingPercentage");
    writer.Write(value.LikingPercentage);

    writer.PropertyName("isLiked");
    writer.Write(value.IsLiked);

    if (value.Creator is not null) {
      writer.PropertyName("creator");
      ScreenshotValueWriter.creatorWriter.Write(writer, value.Creator);
    }

    if (value.ShowcasedMod is not null) {
      writer.PropertyName("showcasedMod");
      ScreenshotValueWriter.showcasedModWriter.Write(writer, value.ShowcasedMod);
    }

    writer.TypeEnd();
  }
}
