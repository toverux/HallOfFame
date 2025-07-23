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

  public override string ToString() =>
    $"Creator #{this.Id} {this.CreatorName}";

  public void Write(IJsonWriter writer) {
    var typeName = this.GetType().FullName;

    writer.TypeBegin(typeName);

    writer.PropertyName("id");
    writer.Write(this.Id);

    writer.PropertyName("creatorName");
    writer.Write(this.CreatorName);

    writer.PropertyName("creatorNameLocale");
    writer.Write(this.CreatorNameLocale);

    writer.PropertyName("creatorNameLatinized");
    writer.Write(this.CreatorNameLatinized);

    writer.PropertyName("creatorNameTranslated");
    writer.Write(this.CreatorNameTranslated);

    writer.PropertyName("socials");
    writer.ArrayBegin(this.Socials.Length);

    foreach (var entry in this.Socials) {
      writer.TypeBegin($"{typeName}/CreatorSocialLink");

      writer.PropertyName("platform");
      writer.Write(entry.Platform);

      writer.PropertyName("link");
      writer.Write(entry.Link);

      writer.TypeEnd();
    }

    writer.ArrayEnd();

    writer.TypeEnd();
  }

  internal record CreatorSocialLink {
    [DecodeAlias("platform")]
    internal string Platform {
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
  }
}
