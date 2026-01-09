using System.Diagnostics;
using Colossal.Json;
using Colossal.UI.Binding;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

[DebuggerDisplay("Like #{Id} on Screenshot #{ScreenshotId}")]
[UsedImplicitly]
internal record Like : IJsonWritable {
  [DecodeAlias("id")]
  internal string Id {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  [DecodeAlias("screenshotId")]
  internal string ScreenshotId {
    get;
    [UsedImplicitly]
    set;
  } = string.Empty;

  public override string ToString() => $"Like #{this.Id} on Screenshot #{this.ScreenshotId}";

  public void Write(IJsonWriter writer) {
    writer.TypeBegin(this.GetType().FullName);

    writer.PropertyName("id");
    writer.Write(this.Id);

    writer.PropertyName("screenshotId");
    writer.Write(this.ScreenshotId);

    writer.TypeEnd();
  }
}
