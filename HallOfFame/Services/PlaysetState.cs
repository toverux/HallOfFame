using System.Collections.Generic;

namespace HallOfFame.Services;

/// <summary>
/// Where the playset of the screenshot <see cref="ScreenshotId"/> stands, as the UI shows it.
/// </summary>
internal sealed record PlaysetState {
  internal required string ScreenshotId { get; init; }

  internal required PlaysetStatus Status { get; init; }

  internal required IReadOnlyList<Domain.Mod> Mods { get; init; }
}

internal enum PlaysetStatus {
  Loading,

  Loaded,

  Failed
}
