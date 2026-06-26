using Colossal.Json;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

/// <summary>
/// Inbound server data decoded via <c>[DecodeAlias]</c>; the outbound UI wire format lives in
/// <see cref="HallOfFame.Utils.Writers.ModValueWriter"/>.
/// </summary>
[UsedImplicitly]
internal record Mod {
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

  [DecodeAlias("tags")]
  internal string[] Tags {
    get;
    [UsedImplicitly]
    set;
  } = [];

  public override string ToString() =>
    $"Mod #{this.Id} (Paradox ID={this.ParadoxModId}) {this.Name} by {this.AuthorName}";
}
