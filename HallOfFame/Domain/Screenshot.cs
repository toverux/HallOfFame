using System;
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
    } = "Unknown [Error]";

    [DecodeAlias("cityName")]
    internal string CityName {
        get;
        [UsedImplicitly]
        set;
    } = "Unknown [Error]";

    [DecodeAlias("cityMilestone")]
    internal int CityMilestone {
        get;
        [UsedImplicitly]
        set;
    } = 1;

    [DecodeAlias("cityPopulation")]
    internal int CityPopulation {
        get;
        [UsedImplicitly]
        set;
    } = 0;

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
    internal int FavoritesCount {
        get;
        [UsedImplicitly]
        set;
    } = 0;

    /// <summary>
    /// Non-inherent property of screenshot only set on some endpoints.
    /// </summary>
    [DecodeAlias("__favorited")]
    internal bool IsFavorite {
        get;
        [UsedImplicitly]
        set;
    }

    [DecodeAlias("creator")]
    internal Creator? Creator { get; set; }

    public override string ToString() =>
        $"Screenshot #{this.Id} {this.CityName} by {this.Creator?.CreatorName}";

    public void Write(IJsonWriter writer) {
        // Type name does not support polymorphism, so we need to include all
        // object shape changes in the type name.
        writer.TypeBegin(
            $"{this.GetType().FullName}?Creator={this.Creator is not null}");

        writer.PropertyName("id");
        writer.Write(this.Id);

        writer.PropertyName("cityName");
        writer.Write(this.CityName);

        writer.PropertyName("cityMilestone");
        writer.Write(this.CityMilestone);

        writer.PropertyName("cityPopulation");
        writer.Write(this.CityPopulation);

        writer.PropertyName("imageUrlFHD");
        writer.Write(this.ImageUrlFHD);

        writer.PropertyName("imageUrl4K");
        writer.Write(this.ImageUrl4K);

        writer.PropertyName("createdAt");
        writer.Write(this.CreatedAt.ToLocalTime().ToString("o"));

        writer.PropertyName("createdAtFormatted");
        writer.Write(this.CreatedAtFormatted);

        writer.PropertyName("createdAtFormattedDistance");
        writer.Write(this.CreatedAtFormattedDistance);

        writer.PropertyName("favoritesCount");
        writer.Write(this.FavoritesCount);

        writer.PropertyName("isFavorite");
        writer.Write(this.IsFavorite);

        if (this.Creator is not null) {
            writer.PropertyName("creator");
            this.Creator.Write(writer);
        }

        writer.TypeEnd();
    }
}
