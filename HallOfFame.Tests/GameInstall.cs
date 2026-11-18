using System;
using System.IO;

namespace HallOfFame.Tests;

/// <summary>
/// The game install the tests read the game's own files from, which the toolchain's
/// <c>CSII_INSTALLATIONPATH</c> locates.
/// </summary>
internal static class GameInstall {
  internal const string Variable = "CSII_INSTALLATIONPATH";

  /// <summary>
  /// Reads the install path from the user scope first, then from the process, as Linux has no user
  /// scope.
  /// </summary>
  internal static string? ReadPath() =>
    Environment.GetEnvironmentVariable(GameInstall.Variable, EnvironmentVariableTarget.User) ??
    Environment.GetEnvironmentVariable(GameInstall.Variable);

  /// <summary>
  /// Reads the game's UI bundle, the frontend whose reads of the game's strings and bindings the
  /// mod relies on.
  /// </summary>
  internal static string ReadUIBundle() {
    var installPath = GameInstall.ReadPath() ??
      throw new InvalidOperationException($"{GameInstall.Variable} is not set.");

    return File.ReadAllText(
      Path.Combine(installPath, "Cities2_Data", "Content", "Game", "UI", "index.js")
    );
  }
}
