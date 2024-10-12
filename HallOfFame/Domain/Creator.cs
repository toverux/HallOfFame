using System.Diagnostics;
using Colossal.Json;
using Colossal.UI.Binding;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

[DebuggerDisplay("Creator(#{Id}) {CreatorName}")]
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

    public override string ToString() =>
        $"Creator(#{this.Id}) {this.CreatorName}";

    public void Write(IJsonWriter writer) {
        writer.TypeBegin(this.GetType().FullName);

        writer.PropertyName("id");
        writer.Write(this.Id);

        writer.PropertyName("creatorName");
        writer.Write(this.CreatorName);

        writer.TypeEnd();
    }
}
