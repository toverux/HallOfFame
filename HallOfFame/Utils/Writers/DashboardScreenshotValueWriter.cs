using Colossal.UI.Binding;
using HallOfFame.Domain;

namespace HallOfFame.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for <see cref="DashboardScreenshot"/>.
/// Its fields keep the names <see cref="ScreenshotValueWriter"/> gives them,
/// so the UI types the record as a pick of its screenshot.
/// </summary>
internal sealed class DashboardScreenshotValueWriter : IWriter<DashboardScreenshot> {
  public void Write(IJsonWriter writer, DashboardScreenshot value) {
    writer.TypeBegin(typeof(DashboardScreenshot).FullName);

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

    writer.PropertyName("imageUrlThumbnail");
    writer.Write(value.ImageUrlThumbnail);

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

    writer.PropertyName("rank");
    writer.Write(value.Rank);

    writer.PropertyName("viewerClicksCount");
    writer.Write(value.ViewerClicksCount);

    writer.PropertyName("isReported");
    writer.Write(value.IsReported);

    writer.TypeEnd();
  }
}
