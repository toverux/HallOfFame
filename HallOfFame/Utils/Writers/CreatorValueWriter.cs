using Colossal.UI.Binding;
using HallOfFame.Domain;

namespace HallOfFame.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for <see cref="Creator"/>.
/// </summary>
internal sealed class CreatorValueWriter : IWriter<Creator> {
  public void Write(IJsonWriter writer, Creator value) {
    var typeName = typeof(Creator).FullName;

    writer.TypeBegin(typeName);

    writer.PropertyName("id");
    writer.Write(value.Id);

    writer.PropertyName("creatorName");
    writer.Write(value.CreatorName);

    writer.PropertyName("creatorNameLocale");
    writer.Write(value.CreatorNameLocale);

    writer.PropertyName("creatorNameLatinized");
    writer.Write(value.CreatorNameLatinized);

    writer.PropertyName("creatorNameTranslated");
    writer.Write(value.CreatorNameTranslated);

    writer.PropertyName("socials");
    writer.ArrayBegin(value.Socials.Length);

    foreach (var entry in value.Socials) {
      writer.TypeBegin($"{typeName}/CreatorSocialLink");

      writer.PropertyName("platform");
      writer.Write(entry.Platform);

      writer.PropertyName("link");
      writer.Write(entry.Link);

      writer.TypeEnd();
    }

    writer.ArrayEnd();

    writer.TypeEnd();
  }
}
