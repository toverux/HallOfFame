using Colossal.UI.Binding;

namespace HallOfFame.Utils.Writers;

/// <summary>
/// Outbound C# to cohtml UI-binding writer for <see cref="HallOfFame.Domain.Mod"/>.
/// </summary>
internal sealed class ModValueWriter : IWriter<Domain.Mod> {
  private static readonly SkyveVerdictValueWriter skyveWriter = new();

  public void Write(IJsonWriter writer, Domain.Mod value) {
    writer.TypeBegin(typeof(Domain.Mod).FullName);

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

    writer.PropertyName("state");
    writer.Write(value.State);

    writer.PropertyName("requiredGameVersion");
    writer.Write(value.RequiredGameVersion);

    writer.PropertyName("sizeFormatted");
    writer.Write(value.SizeFormatted);

    writer.PropertyName("knownLastReleasedAtFormattedDistance");
    writer.Write(value.KnownLastReleasedAtFormattedDistance);

    writer.PropertyName("knownLastReleasedAt");
    writer.Write(value.KnownLastReleasedAt);

    writer.PropertyName("skyve");
    ModValueWriter.skyveWriter.Write(writer, value.Skyve);

    writer.TypeEnd();
  }
}
