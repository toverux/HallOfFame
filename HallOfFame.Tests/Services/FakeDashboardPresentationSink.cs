using System.Collections.Generic;
using System.Linq;
using HallOfFame.Services;

namespace HallOfFame.Tests.Services;

/// <summary>
/// Handwritten <see cref="IDashboardPresentationSink"/> test double recording every push,
/// in one ordered log so a test can assert what was published before what.
/// </summary>
internal sealed class FakeDashboardPresentationSink : IDashboardPresentationSink {
  /// <summary>
  /// Every push in order, by its status's name,
  /// a loaded one followed by its screenshots' IDs (ex. "Loaded:a,b").
  /// </summary>
  internal List<string> Log { get; } = [];

  internal DashboardState LastState { get; private set; } = DashboardState.Closed;

  public void Publish(DashboardState state) {
    this.LastState = state;

    if (state.Status is DashboardStatus.Loaded) {
      var ids = string.Join(",", state.Screenshots.Select(screenshot => screenshot.Id));

      this.Log.Add($"{state.Status}:{ids}");
    }
    else {
      this.Log.Add(state.Status.ToString());
    }
  }
}
