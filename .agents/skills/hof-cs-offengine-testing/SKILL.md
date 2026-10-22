---
name: hof-cs-offengine-testing
description: Write and run the mod's C# unit tests off-engine. Use when writing or running C# tests, when a test hits an engine-bound type or throws TypeLoadException off-engine, or when deciding where to put logic so it stays testable.
---

# C# Off-Engine Testing

The mod's C# tests run **off-engine**: a plain `net48` xUnit process, not a booted game.
Everything below follows from that one fact.
Code that reaches the engine (Unity native calls, the game's logging stack, a live ECS `World`) cannot run here, so the job is to test product logic in isolation and keep engine-bound code behind a seam you can fake.

Tests live in the `HallOfFame.Tests` project.

## Run

```
mise test:cs
```

This runs `dotnet test` with `-p:SkipBuildUI=true -p:SkipModPostProcess=true`, so the TypeScript UI build and the mod post-processor are skipped (the tests need neither).
Prefer it over a bare `dotnet test`.
On Linux, Mono hosts the `net48` test process and needs `mono-devel`: without its framework facades the test host crashes before any test runs.
`dotnet test` runs through Microsoft.Testing.Platform, which the root `global.json` selects: VSTest no longer hosts .NET Framework tests under Mono.
The `RunTestsUnderMono` target in `HallOfFame.Tests.csproj` names Mono as the command that starts the tests (`-p:MonoPath=<path>` when `mono` is not on PATH): without it, the .NET 11 SDK picks no runner for a .NET Framework executable on Linux and fails with NETSDK1243.
The suite does not run on Windows, which is not a target.
The .NET Framework host starts only with an `App.config` redirecting `netstandard` (`0.0.0.0-2.1.0.0` to `2.0.0.0`), which Mono ignores; dropping the generated redirect instead lets it start, but each later netstandard 2.1 load throws `FileNotFoundException`.
Even redirected, it cannot run default interface methods (`Colossal.Logging.ILog`, `NativeList`), netstandard 2.1 types (`System.HashCode`), or any Unity native call (`SecurityException`).

## Where testable logic goes

- Put logic you want to test in plain `Services/` classes (e.g. `StatsNotifier`, `ScreenshotCarousel`).
  These construct fine off-engine.
- ECS `Systems/` **cannot be instantiated off-engine** at all.
  When a system holds logic worth testing, extract it into a plain `Services/` class and have the system delegate to it.
- For UI behavior that can't be unit-tested, drive the live mod UI over Gameface CDP instead (load the `coherent-gameface:gameface-driving` skill).
  Off-engine xUnit and live CDP are complementary, not rivals.

## What loads off-engine

`HallOfFame.Tests.csproj` copies the game assemblies it references from `CSII_MANAGEDPATH` (the game's `Managed` folder) next to the tests, with their dependencies, so they load like the project's own.
Pure managed assemblies load fine this way: `Colossal.Core`, `Colossal.UI.Binding`, and `Game.dll`.
So domain records (`Screenshot`, `CreatorStats`, ...) and pure managed structs like `Game.UI.Localization.LocalizedString` are test-constructible (the test project has `InternalsVisibleTo`).

## What fails off-engine, and the seam to use instead

Loading the game assemblies cannot save you from code that makes Unity **native** calls or loads engine-only types.
Never let a test touch these directly; depend on a mod-owned interface and inject a fake.

- **HTTP / `HttpQueries`.** Its static constructor calls `SystemInfo.deviceUniqueIdentifier` (native) and its methods take `UnityWebRequest`, so instantiating it off-engine fails.
  Depend on `IHallOfFameApi` and inject `FakeApi`; never `new HttpQueries`.
  Constructing the nested `HttpQueries.JsonError` is safe, because a nested type does not trigger the enclosing type's static constructor.
- **Logging / `Colossal.Logging.ILog`.** Do not depend on it.
  `ILog` uses C# default interface methods that the **net48 CLR cannot load** (`TypeLoadException` the moment `ILog` is touched, e.g. via `LogManager.GetLogger`), and `LogManager` is engine-bound regardless of runtime.
  Changing the test `TargetFramework` does **not** help; the blocker is engine-boundness, not the CLR.
  Depend on the mod-owned `IModLog` seam (`HallOfFame/Logging/`) and inject `FakeModLog` instead.

## Fakes

Fakes are handwritten and kept to the smallest viable shape; no mocking library is used.
The convention (see `HallOfFame.Tests/Http/FakeApi.cs` and `HallOfFame.Tests/Logging/FakeModLog.cs`):

- One settable delegate per method the test actually wires up.
- Every method left unwired throws `NotImplementedException` (or is a no-op for pure side effects like logging), so an unexpected call fails loudly instead of passing silently.

## The game's own test framework

Cities: Skylines II ships its own in-engine test framework, but none of it is reachable from this off-engine project.
If you are wondering whether to reuse it, read [game-test-framework.md](game-test-framework.md).
