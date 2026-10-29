using System.Collections.Generic;
using HallOfFame.Services;

namespace HallOfFame.Tests.Services;

/// <summary>
/// In-memory <see cref="IMenuTourStore"/> test double: one instance shared by two
/// <see cref="MenuTour"/>s stands in for a settings file outliving a game restart.
/// </summary>
internal sealed class FakeMenuTourStore : IMenuTourStore {
  public bool HasSeenMenuTour { get; set; }

  /// <summary>
  /// The value of <see cref="HasSeenMenuTour"/> at each <see cref="Save"/>, in call order.
  /// </summary>
  public List<bool> Saves { get; } = [];

  public void Save() => this.Saves.Add(this.HasSeenMenuTour);
}
