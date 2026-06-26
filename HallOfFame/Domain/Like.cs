using System.Diagnostics;
using Colossal.Json;
using JetBrains.Annotations;

namespace HallOfFame.Domain;

[DebuggerDisplay("Like #{Id} on Screenshot #{ScreenshotId}")]
[UsedImplicitly]
internal record Like {
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
}
