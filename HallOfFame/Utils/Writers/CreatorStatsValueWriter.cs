using Colossal.UI.Binding;
using HallOfFame.Domain;

namespace HallOfFame.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for <see cref="CreatorStats"/>.
/// </summary>
internal sealed class CreatorStatsValueWriter : IWriter<CreatorStats> {
  public void Write(IJsonWriter writer, CreatorStats value) {
    writer.TypeBegin(typeof(CreatorStats).FullName);

    writer.PropertyName("screenshotsCount");
    writer.Write(value.ScreenshotsCount);

    writer.PropertyName("viewsCount");
    writer.Write(value.ViewsCount);

    writer.PropertyName("uniqueViewsCount");
    writer.Write(value.UniqueViewsCount);

    writer.PropertyName("likesCount");
    writer.Write(value.LikesCount);

    writer.PropertyName("rankMinUniqueViewsCount");
    writer.Write(value.RankMinUniqueViewsCount);

    writer.PropertyName("rankMinLikesCount");
    writer.Write(value.RankMinLikesCount);

    writer.TypeEnd();
  }
}
