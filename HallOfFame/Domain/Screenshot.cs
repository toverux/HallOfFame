using System;
using System.Diagnostics;
using Colossal.Json;
using Colossal.UI.Binding;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

[DebuggerDisplay("{CityName} by {Creator.CreatorName} (#{Id})")]
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

    [DecodeAlias("creator")]
    internal Creator? Creator { get; set; }

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

        if (this.Creator is not null) {
            writer.PropertyName("creator");
            this.Creator.Write(writer);
        }

        writer.TypeEnd();
    }
}
