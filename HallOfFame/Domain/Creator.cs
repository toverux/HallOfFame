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
  internal string Id { get; [UsedImplicitly] set; } = string.Empty;

  // Null for anonymous creators.
  [DecodeAlias("creatorName")]
  internal string? CreatorName { get; [UsedImplicitly] set; }

  [DecodeAlias("creatorNameLocale")]
  internal string? CreatorNameLocale { get; [UsedImplicitly] set; }

  [DecodeAlias("creatorNameLatinized")]
  internal string? CreatorNameLatinized { get; [UsedImplicitly] set; }

  [DecodeAlias("creatorNameTranslated")]
  internal string? CreatorNameTranslated { get; [UsedImplicitly] set; }

  /// <summary>
  /// Tracked redirect to this creator's page on the web viewer: it counts the click, then 307s to
  /// <see cref="HallOfFame.Utils.WebViewer.CreatorPageUrl"/>.
  /// Use it for a real human click; use the clean page URL for a link the player copies.
  /// </summary>
  [DecodeAlias("viewerUrl")]
  internal string ViewerUrl { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("socials")]
  // ReSharper disable once CollectionNeverUpdated.Global
  internal CreatorSocialLink[] Socials { get; [UsedImplicitly] set; } = [];

  public override string ToString() => $"Creator #{this.Id} {this.CreatorName}";

  internal record CreatorSocialLink {
    [DecodeAlias("platform")]
    internal string Platform { get; [UsedImplicitly] set; } = string.Empty;

    [DecodeAlias("link")]
    internal string Link { get; [UsedImplicitly] set; } = string.Empty;
  }
}
