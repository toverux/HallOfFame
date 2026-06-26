using System;
using System.IO;
using System.Reflection;
using System.Runtime.CompilerServices;

namespace HallOfFame.Tests;

/// <summary>
/// Lets the test process load Cities: Skylines II managed assemblies on demand.
/// The mod's domain types pull in Colossal assemblies (ex. <c>Colossal.Core</c>,
/// <c>Colossal.UI.Binding</c>) that are referenced for compilation only and are not copied next to
/// the test binaries, so this probes the game's <c>Managed</c> folder to resolve them at runtime.
/// The hook is installed via a <see cref="ModuleInitializerAttribute"/> so it is in place before
/// any test method JITs a game type.
/// </summary>
internal static class GameAssemblyResolver {
  private static readonly string ManagedPath =
    Environment.GetEnvironmentVariable("CSII_MANAGEDPATH", EnvironmentVariableTarget.User) ??
    string.Empty;

  [ModuleInitializer]
  internal static void Install() {
    AppDomain.CurrentDomain.AssemblyResolve += GameAssemblyResolver.Resolve;
  }

  private static Assembly? Resolve(object? sender, ResolveEventArgs args) {
    if (GameAssemblyResolver.ManagedPath.Length is 0) {
      return null;
    }

    var assemblyName = new AssemblyName(args.Name).Name;

    if (assemblyName is null) {
      return null;
    }

    var candidate = Path.Combine(GameAssemblyResolver.ManagedPath, $"{assemblyName}.dll");

    return File.Exists(candidate)
      ? Assembly.LoadFrom(candidate)
      : null;
  }
}
