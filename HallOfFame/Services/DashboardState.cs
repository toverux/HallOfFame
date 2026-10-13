using System.Collections.Generic;
using Game.UI.Localization;
using HallOfFame.Domain;

namespace HallOfFame.Services;

/// <summary>
/// Where the Creator Dashboard stands, as the UI shows it:
/// each status with the payload it alone carries,
/// so the UI never meets a collection without its stats or an error without its message.
/// </summary>
internal sealed record DashboardState {
  internal static readonly DashboardState Closed = new(DashboardStatus.Closed);

  internal static readonly DashboardState Loading = new(DashboardStatus.Loading);

  internal DashboardStatus Status { get; }

  /// <summary>
  /// The creator's whole collection in the server's order, empty unless loaded.
  /// </summary>
  internal IReadOnlyList<DashboardScreenshot> Screenshots { get; private init; } = [];

  /// <summary>
  /// The creator's totals and ranking thresholds, <c>null</c> unless loaded.
  /// </summary>
  internal CreatorStats? Stats { get; private init; }

  /// <summary>
  /// Why the last load failed, <c>null</c> unless in error.
  /// </summary>
  internal LocalizedString? Error { get; private init; }

  private DashboardState(DashboardStatus status) {
    this.Status = status;
  }

  internal static DashboardState Loaded(
    IReadOnlyList<DashboardScreenshot> screenshots,
    CreatorStats stats
  ) => new(DashboardStatus.Loaded) {
    Screenshots = screenshots,
    Stats = stats
  };

  internal static DashboardState Failed(LocalizedString error) => new(DashboardStatus.Error) {
    Error = error
  };
}

internal enum DashboardStatus {
  Closed,

  Loading,

  Loaded,

  Error
}
