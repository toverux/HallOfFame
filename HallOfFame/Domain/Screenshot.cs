using System;
using System.Collections.Generic;
using System.Diagnostics;
using Colossal.Json;
using Colossal.UI.Binding;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

[DebuggerDisplay("Screenshot #{Id} {CityName} by {Creator.CreatorName}")]
[UsedImplicitly]
internal record Screenshot : IJsonWritable {
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

  public void Write(IJsonWriter writer) {
    // Type name does not support polymorphism, so we need to include all object shape changes in
    // the type name.
    writer.TypeBegin(
      $"{this.GetType().FullName}" +
      $"?Creator={this.Creator is not null}" +
      $"&ShowcasedMod={this.ShowcasedMod is not null}"
    );

    writer.PropertyName("id");
    writer.Write(this.Id);

    writer.PropertyName("cityName");
    writer.Write(this.CityName);

    writer.PropertyName("cityNameLocale");
    writer.Write(this.CityNameLocale);

    writer.PropertyName("cityNameLatinized");
    writer.Write(this.CityNameLatinized);

    writer.PropertyName("cityNameTranslated");
    writer.Write(this.CityNameTranslated);

    writer.PropertyName("cityMilestone");
    writer.Write(this.CityMilestone);

    writer.PropertyName("cityPopulation");
    writer.Write(this.CityPopulation);

    writer.PropertyName("mapName");
    writer.Write(this.MapName);

    writer.PropertyName("description");
    writer.Write(this.Description);

    writer.PropertyName("imageUrlFHD");
    writer.Write(this.ImageUrlFHD);

    writer.PropertyName("imageUrl4K");
    writer.Write(this.ImageUrl4K);

    writer.PropertyName("shareRenderSettings");
    writer.Write(this.ShareRenderSettings);

    writer.PropertyName("renderSettings");
    writer.Write(this.RenderSettings);

    writer.PropertyName("createdAt");
    writer.Write(this.CreatedAt.ToLocalTime().ToString("o"));

    writer.PropertyName("createdAtFormatted");
    writer.Write(this.CreatedAtFormatted);

    writer.PropertyName("createdAtFormattedDistance");
    writer.Write(this.CreatedAtFormattedDistance);

    writer.PropertyName("likesCount");
    writer.Write(this.LikesCount);

    writer.PropertyName("viewsCount");
    writer.Write(this.ViewsCount);

    writer.PropertyName("uniqueViewsCount");
    writer.Write(this.UniqueViewsCount);

    writer.PropertyName("likingPercentage");
    writer.Write(this.LikingPercentage);

    writer.PropertyName("isLiked");
    writer.Write(this.IsLiked);

    if (this.Creator is not null) {
      writer.PropertyName("creator");
      this.Creator.Write(writer);
    }

    if (this.ShowcasedMod is not null) {
      writer.PropertyName("showcasedMod");
      this.ShowcasedMod.Write(writer);
    }

    writer.TypeEnd();
  }
}
