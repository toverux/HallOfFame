using System;
using System.Diagnostics;
using Colossal.Json;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

/// <summary>
/// One screenshot of the creator's own collection, as the Creator Dashboard's grid reads it:
/// the fields of <see cref="Screenshot"/> its cards, their tooltips, and its tally show,
/// and nothing more.
/// Decoding the full record for a whole collection costs seconds of reflection,
/// most of it on nested data the grid never reads, so the list decodes into this one.
/// The outbound UI wire format lives in
/// <see cref="HallOfFame.Utils.Writers.DashboardScreenshotValueWriter"/>.
/// </summary>
[DebuggerDisplay("DashboardScreenshot #{Id} {CityName}")]
[UsedImplicitly]
internal record DashboardScreenshot {
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

  [DecodeAlias("imageUrlThumbnail")]
  internal string ImageUrlThumbnail { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("createdAt")]
  internal DateTime CreatedAt { get; [UsedImplicitly] set; } = default;

  [DecodeAlias("createdAtFormatted")]
  internal string CreatedAtFormatted { get; [UsedImplicitly] set; } = string.Empty;

  [DecodeAlias("createdAtFormattedDistance")]
  internal string CreatedAtFormattedDistance { get; [UsedImplicitly] set; } = string.Empty;

  // The server uses "favorite" terminology where the mod and UI use "like":
  // the `[DecodeAlias]` carries the server field name and the property holds the mod/UI name.
  [DecodeAlias("favoritesCount")]
  internal int LikesCount { get; [UsedImplicitly] set; }

  [DecodeAlias("viewsCount")]
  internal int ViewsCount { get; [UsedImplicitly] set; }

  [DecodeAlias("uniqueViewsCount")]
  internal int UniqueViewsCount { get; [UsedImplicitly] set; }

  /// <inheritdoc cref="Screenshot.Rank"/>
  [DecodeAlias("rank")]
  internal string? Rank { get; [UsedImplicitly] set; }

  /// <inheritdoc cref="Screenshot.ViewerClicksCount"/>
  [DecodeAlias("viewerClicksCount")]
  internal int ViewerClicksCount { get; [UsedImplicitly] set; }

  /// <inheritdoc cref="Screenshot.IsReported"/>
  [DecodeAlias("isReported")]
  internal bool IsReported { get; [UsedImplicitly] set; }
}
