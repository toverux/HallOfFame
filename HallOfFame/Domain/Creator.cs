using System.Collections.Generic;
using System.Diagnostics;
using Colossal.Json;
using Colossal.UI.Binding;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

[DebuggerDisplay("Creator #{Id} {CreatorName}")]
[UsedImplicitly]
internal record Creator : IJsonWritable {
    [DecodeAlias("id")]
    internal string Id {
        get;
        [UsedImplicitly]
        set;
    } = "Unknown [Error]";

    [DecodeAlias("creatorName")]
    internal string CreatorName {
        get;
        [UsedImplicitly]
        set;
    } = "Unknown [Error]";

    [DecodeAlias("social")]
    // ReSharper disable once CollectionNeverUpdated.Global
    internal Dictionary<string, CreatorSocialLink> Social {
        get;
        [UsedImplicitly]
        set;
    } = new();

    public override string ToString() =>
        $"Creator #{this.Id} {this.CreatorName}";

    public void Write(IJsonWriter writer) {
        var typeName = this.GetType().FullName;

        writer.TypeBegin(typeName);

        writer.PropertyName("id");
        writer.Write(this.Id);

        writer.PropertyName("creatorName");
        writer.Write(this.CreatorName);

        writer.PropertyName("social");
        writer.ArrayBegin(this.Social.Count);

        foreach (var kvp in this.Social) {
            writer.TypeBegin($"{typeName}/CreatorSocialLink");

            writer.PropertyName("platform");
            writer.Write(kvp.Key);

            writer.PropertyName("description");
            writer.Write(kvp.Value.Description);

            writer.PropertyName("link");
            writer.Write(kvp.Value.Link);

            writer.PropertyName("username");
            writer.Write(kvp.Value.Username);

            writer.TypeEnd();
        }

        writer.ArrayEnd();

        writer.TypeEnd();
    }

    internal record CreatorSocialLink {
        [DecodeAlias("description")]
        internal string Description {
            get;
            [UsedImplicitly]
            set;
        } = "Unknown [Error]";

        [DecodeAlias("link")]
        internal string Link {
            get;
            [UsedImplicitly]
            set;
        } = "Unknown [Error]";

        [DecodeAlias("username")]
        internal string? Username {
            get;
            [UsedImplicitly]
            set;
        }
    }
}
