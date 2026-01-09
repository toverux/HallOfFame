using Colossal.Json;
using Colossal.UI.Binding;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

[UsedImplicitly]
internal record Mod : IJsonWritable {
  [DecodeAlias("id")]
  internal string Id {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("paradoxModId")]
  internal int ParadoxModId {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("name")]
  internal string Name {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("authorName")]
  internal string AuthorName {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("shortDescription")]
  internal string ShortDescription {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("thumbnailUrl")]
  internal string ThumbnailUrl {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("subscribersCount")]
  internal int SubscribersCount {
    get;
    [UsedImplicitly]
    set;
  }

  public override string ToString() =>
    $"Mod #{this.Id} (Paradox ID={this.ParadoxModId}) {this.Name} by {this.AuthorName}";

  public void Write(IJsonWriter writer) {
    writer.TypeBegin(this.GetType().FullName);

    writer.PropertyName("id");
    writer.Write(this.Id);

    writer.PropertyName("paradoxModId");
    writer.Write(this.ParadoxModId);

    writer.PropertyName("name");
    writer.Write(this.Name);

    writer.PropertyName("authorName");
    writer.Write(this.AuthorName);

    writer.PropertyName("shortDescription");
    writer.Write(this.ShortDescription);

    writer.PropertyName("thumbnailUrl");
    writer.Write(this.ThumbnailUrl);

    writer.PropertyName("subscribersCount");
    writer.Write(this.SubscribersCount);

    writer.TypeEnd();
  }
}
