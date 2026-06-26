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
  internal string Id {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("cityName")]
  internal string CityName {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("cityNameLocale")]
  internal string? CityNameLocale {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("cityNameLatinized")]
  internal string? CityNameLatinized {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("cityNameTranslated")]
  internal string? CityNameTranslated {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("cityMilestone")]
  internal int CityMilestone {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("cityPopulation")]
  internal int CityPopulation {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("mapName")]
  internal string MapName {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("description")]
  internal string Description {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("imageUrlFHD")]
  internal string ImageUrlFHD {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("imageUrl4K")]
  internal string ImageUrl4K {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("shareRenderSettings")]
  internal bool ShareRenderSettings {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("renderSettings")]
  // ReSharper disable once CollectionNeverUpdated.Global
  internal Dictionary<string, string> RenderSettings {
    get;
    [UsedImplicitly]
    set;
  } = new();

  [DecodeAlias("createdAt")]
  internal DateTime CreatedAt {
    get;
    [UsedImplicitly]
    set;
  } = default;

  [DecodeAlias("createdAtFormatted")]
  internal string CreatedAtFormatted {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("createdAtFormattedDistance")]
  internal string CreatedAtFormattedDistance {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("favoritesCount")]
  internal int LikesCount {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("viewsCount")]
  internal int ViewsCount {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("uniqueViewsCount")]
  internal int UniqueViewsCount {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("favoritingPercentage")]
  internal int LikingPercentage {
    get;
    [UsedImplicitly]
    set;
  }

  /// <summary>
  /// Non-inherent property of screenshot only set on some endpoints.
  /// </summary>
  [DecodeAlias("__favorited")]
  internal bool IsLiked {
    get;
    [UsedImplicitly]
    set;
  }

  /// <summary>
  /// Non-inherent property of a screenshot only set on the "get screenshot with weighted
  /// algorithms" endpoint.
  /// </summary>
  [DecodeAlias("__algorithm")]
  internal string Algorithm {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("creator")]
  internal Creator? Creator {
    get;
    [UsedImplicitly]
    set;
  }

  [DecodeAlias("showcasedMod")]
  internal Mod? ShowcasedMod {
    get;
    [UsedImplicitly]
    set;
  }

  public override string ToString() =>
    $"Screenshot #{this.Id} {this.CityName} by {this.Creator?.CreatorName}";
}
