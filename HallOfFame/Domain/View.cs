using System.Diagnostics;
using Colossal.Json;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

[DebuggerDisplay("View #{Id} on Screenshot #{ScreenshotId}")]
[UsedImplicitly]
internal record View {
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

  public override string ToString() => $"View #{this.Id} on Screenshot #{this.ScreenshotId}";
}
