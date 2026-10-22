using System;
using System.Collections.Generic;
using System.Diagnostics;
using Colossal.Json;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

/// <summary>
/// Inbound server data decoded via <c>[DecodeAlias]</c>; the outbound UI wire format lives in
/// <see cref="HallOfFame.Utils.Writers.ScreenshotValueWriter"/>.
/// </summary>
[DebuggerDisplay("Screenshot #{Id} {CityName} by {Creator.CreatorName}")]
[UsedImplicitly]
internal record Screenshot {
  [DecodeAlias("id")]
  internal string Id { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("cityName")]
  internal string CityName { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("cityNameLocale")]
  internal string? CityNameLocale { get; [UsedImplicitly] set; }

  [DecodeAlias("cityNameLatinized")]
  internal string? CityNameLatinized { get; [UsedImplicitly] set; }

  [DecodeAlias("cityNameTranslated")]
  internal string? CityNameTranslated { get; [UsedImplicitly] set; }

  [DecodeAlias("cityMilestone")]
  internal int CityMilestone { get; [UsedImplicitly] set; }

  [DecodeAlias("cityPopulation")]
  internal int CityPopulation { get; [UsedImplicitly] set; }

  [DecodeAlias("mapName")]
  internal string MapName { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("description")]
  internal string Description { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("imageUrlThumbnail")]
  internal string ImageUrlThumbnail { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("imageUrlFHD")]
  internal string ImageUrlFHD { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("imageUrl4K")]
  internal string ImageUrl4K { get; [UsedImplicitly] set; } = string.Empty;

  /// <summary>
  /// Tracked redirect to this screenshot's page on the web viewer: it counts the click, then 307s
  /// to <see cref="HallOfFame.Utils.WebViewer.ScreenshotPageUrl"/>.
  /// Use it for a real human click; use the clean page URL for a link the player copies.
  /// </summary>
  [DecodeAlias("viewerUrl")]
  internal string ViewerUrl { get; [UsedImplicitly] set; } = string.Empty;

  /// <summary>
  /// The playset's Paradox Mods IDs, empty when the creator did not share it or none was recorded.
  /// </summary>
  [DecodeAlias("paradoxModIds")]
  internal int[] ParadoxModIds { get; [UsedImplicitly] set; } = [];

  /// <summary>
  /// Whether the creator shared the playset; the server still sends a creator their own unshared
  /// <see cref="ParadoxModIds"/>.
  /// </summary>
  [DecodeAlias("shareParadoxModIds")]
  internal bool ShareParadoxModIds { get; [UsedImplicitly] set; }

  [DecodeAlias("shareRenderSettings")]
  internal bool ShareRenderSettings { get; [UsedImplicitly] set; }

  /// <summary>
  /// Decoded as numbers: Colossal.Json writes a number into a string in the player's culture,
  /// whose decimal separator may be a comma.
  /// </summary>
  [DecodeAlias("renderSettings")]
  // ReSharper disable once CollectionNeverUpdated.Global
  internal Dictionary<string, double> RenderSettings { get; [UsedImplicitly] set; } = new();

  /// <summary>
  /// Shared under <see cref="ShareRenderSettings"/>, empty for a screenshot whose upload recorded
  /// none.
  /// </summary>
  [DecodeAlias("renderConditions")]
  // ReSharper disable once CollectionNeverUpdated.Global
  internal RenderConditions RenderConditions { get; [UsedImplicitly] set; } = new();

  /// <summary>
  /// The server fields holding what the uploading mod captured, e.g. "description".
  /// A field missing from it holds a default: the screenshot predates the mod release capturing it.
  /// </summary>
  [DecodeAlias("capabilities")]
  internal string[] Capabilities { get; [UsedImplicitly] set; } = [];

  [DecodeAlias("createdAt")]
  internal DateTime CreatedAt { get; [UsedImplicitly] set; } = default;

  [DecodeAlias("createdAtFormatted")]
  internal string CreatedAtFormatted { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("createdAtFormattedDistance")]
  internal string CreatedAtFormattedDistance { get; [UsedImplicitly] set; } = string.Empty;

  // The server uses "favorite" terminology where the mod and UI use "like".
  // Here the `[DecodeAlias]` carries the server field name and the property holds the mod/UI name.
  // The same rename applies to LikingPercentage and IsLiked below.
  [DecodeAlias("favoritesCount")]
  internal int LikesCount { get; [UsedImplicitly] set; }

  [DecodeAlias("viewsCount")]
  internal int ViewsCount { get; [UsedImplicitly] set; }

  [DecodeAlias("uniqueViewsCount")]
  internal int UniqueViewsCount { get; [UsedImplicitly] set; }

  // The favorite/like rename; see the note on LikesCount above.
  [DecodeAlias("favoritingPercentage")]
  internal int LikingPercentage { get; [UsedImplicitly] set; }

  /// <summary>
  /// The medal tier, "bronze" to "diamond", or null below either of the
  /// <see cref="CreatorStats"/> rank minimums.
  /// </summary>
  [DecodeAlias("rank")]
  internal string? Rank { get; [UsedImplicitly] set; }

  /// <summary>
  /// Clicks through <see cref="ViewerUrl"/> to the web viewer.
  /// </summary>
  [DecodeAlias("viewerClicksCount")]
  internal int ViewerClicksCount { get; [UsedImplicitly] set; }

  /// <summary>
  /// Whether a player reported it: the slideshow stops serving it until a moderator reviews it.
  /// </summary>
  [DecodeAlias("isReported")]
  internal bool IsReported { get; [UsedImplicitly] set; }

  /// <summary>
  /// Non-inherent property of screenshot only set on some endpoints.
  /// The favorite/like rename applies here too; see the note on <see cref="LikesCount"/>.
  /// </summary>
  [DecodeAlias("__favorited")]
  internal bool IsLiked { get; [UsedImplicitly] set; }

  /// <summary>
  /// Non-inherent property of a screenshot only set on the "get screenshot with weighted
  /// algorithms" endpoint.
  /// </summary>
  [DecodeAlias("__algorithm")]
  internal string Algorithm { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("creator")]
  internal Creator? Creator { get; [UsedImplicitly] set; }

  [DecodeAlias("showcasedMod")]
  internal Mod? ShowcasedMod { get; [UsedImplicitly] set; }

  public override string ToString() =>
    $"Screenshot #{this.Id} {this.CityName} by {this.Creator?.CreatorName}";
}
