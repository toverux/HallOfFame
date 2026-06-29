using System.Diagnostics;
using Colossal.Json;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

/// <summary>
/// Inbound server data decoded via <c>[DecodeAlias]</c>; the outbound UI wire format lives in
/// <see cref="HallOfFame.Utils.Writers.CreatorValueWriter"/>.
/// </summary>
[DebuggerDisplay("Creator #{Id} {CreatorName}")]
[UsedImplicitly]
internal record Creator {
  [DecodeAlias("id")]
  internal string Id {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  // Null for anonymous creators.
  [DecodeAlias("creatorName")]
  internal string? CreatorName {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("creatorNameLocale")]
  internal string? CreatorNameLocale {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("creatorNameLatinized")]
  internal string? CreatorNameLatinized {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("creatorNameTranslated")]
  internal string? CreatorNameTranslated {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("socials")]
  // ReSharper disable once CollectionNeverUpdated.Global
  internal CreatorSocialLink[] Socials {
    get;
    [UsedImplicitly]
    set;
  } = [];

  public override string ToString() => $"Creator #{this.Id} {this.CreatorName}";

  internal record CreatorSocialLink {
    [DecodeAlias("platform")]
    internal string Platform {
      get;
      [UsedImplicitly]
      set;
    } = string.Empty;

    [DecodeAlias("link")]
    internal string Link {
      get;
      [UsedImplicitly]
      set;
    } = string.Empty;
  }
}
