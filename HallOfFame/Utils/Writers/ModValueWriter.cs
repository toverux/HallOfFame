using Colossal.UI.Binding;

namespace HallOfFame.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for <see cref="HallOfFame.Domain.Mod"/>.
/// </summary>
internal sealed class ModValueWriter : IWriter<HallOfFame.Domain.Mod> {
  public void Write(IJsonWriter writer, HallOfFame.Domain.Mod value) {
    writer.TypeBegin(typeof(HallOfFame.Domain.Mod).FullName);

    writer.PropertyName("id");
    writer.Write(value.Id);

    writer.PropertyName("paradoxModId");
    writer.Write(value.ParadoxModId);

    writer.PropertyName("name");
    writer.Write(value.Name);

    writer.PropertyName("authorName");
    writer.Write(value.AuthorName);

    writer.PropertyName("shortDescription");
    writer.Write(value.ShortDescription);

    writer.PropertyName("thumbnailUrl");
    writer.Write(value.ThumbnailUrl);

    writer.PropertyName("subscribersCount");
    writer.Write(value.SubscribersCount);

    writer.PropertyName("tags");
    writer.Write(value.Tags);

    writer.TypeEnd();
  }
}
