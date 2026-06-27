using System;
using System.Threading.Tasks;
using HallOfFame.Services;

namespace HallOfFame.Tests.Services;

/// <summary>
/// Handwritten <see cref="IImagePreloader"/> test double, mirroring <c>FakeApi</c>.
/// A test wires <see cref="PreloadImpl"/> only when it needs to observe the URL or simulate a
/// failure; left unset, every preload succeeds immediately.
/// </summary>
internal sealed class FakePreloader : IImagePreloader {
  internal Func<string, Task>? PreloadImpl { get; init; }

  public Task Preload(string url) =>
    this.PreloadImpl?.Invoke(url) ?? Task.CompletedTask;
}
