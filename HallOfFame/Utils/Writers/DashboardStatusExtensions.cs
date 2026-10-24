using System;
using HallOfFame.Services;

namespace HallOfFame.Utils.Writers;

internal static class DashboardStatusExtensions {
  extension(DashboardStatus status) {
    /// <summary>
    /// The status's name in the UI's binding types, which every dashboard writer sends.
    /// </summary>
    internal string ToWireName() =>
      status switch {
        DashboardStatus.Closed => "closed",
        DashboardStatus.Loading => "loading",
        DashboardStatus.Loaded => "loaded",
        DashboardStatus.Error => "error",
        _ => throw new InvalidOperationException($"Unknown status {status}.")
      };
  }
}
