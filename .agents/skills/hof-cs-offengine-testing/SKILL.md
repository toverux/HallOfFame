---
name: hof-cs-offengine-testing
description: Write and run the mod's C# tests off-engine, on .NET 10. Use when writing or running a C# test, when a test throws on a Unity or game type (SecurityException, TypeLoadException), or when deciding where logic goes so it stays testable.
---

# C# off-engine testing

The mod's C# tests run **off-engine**: a `net10.0` xUnit v3 process on CoreCLR, alike on Linux and Windows, with no game, no Unity player and no ECS world.
Everything below follows from that one fact.
Code that reaches the engine (most Unity native calls, the game's logging stack, a live `World`) cannot run here, so the job is to test product logic in isolation and keep engine-bound code behind a seam you can fake.

Tests live in [`HallOfFame.Tests`](../../../HallOfFame.Tests), one folder per mod folder they cover.

## Run

```
mise test:cs
```

It skips the UI build, the mod post-processor and the deploy.

For a focused run, append a filter, which mise hands to `dotnet test`:

```
mise test:cs --filter-class '*ModLogTests'
```

## Where testable logic goes

- An ECS system **cannot be instantiated** off-engine: it needs a world.
  Give the logic it holds a pure, `internal static` home the system calls, and test that.
  A Burst job's body is the same: the static method it calls runs here.
- Logic that grows past a helper goes in a plain class constructed without the engine, its engine-bound collaborators passed in behind a mod-owned interface: here, a `Services/` class (`StatsNotifier`, `ScreenshotCarousel`).
- A seam earns its place when an off-engine test pins behaviour behind it: data a system reads and binds unchanged stays in the system rather than relaying through such a class.
- The mod's csproj names the test project in `InternalsVisibleTo`: keep test-only access `internal`, never `public`.
- What needs the live game (a system over a loaded city, a prefab, a save) is checked in the running game: the `cs2-modding` skill's game-cycle reference.

## What loads off-engine

The test project copies the game assemblies the mod references from `CSII_MANAGEDPATH` next to the tests, so they load like its own.
Pure managed code runs as it is: `Unity.Mathematics`, `Colossal.Mathematics`, the plain structs and static helpers of `Game.dll`, `Game.UI.Localization.LocalizedString`, `Colossal.Logging.ILog` (its default interface methods load on CoreCLR).

Unity native memory runs too, through the native-call shim, [`Shim/UnityNativeCalls.cs`](../../../HallOfFame.Tests/Shim/UnityNativeCalls.cs): `NativeArray` with real allocators, a growing `NativeList`, hash maps, queues, sorting and fixed strings.
It rewrites `UnityEngine.CoreModule` at load so each extern it lists calls a managed replacement.
Every other Unity extern throws `SecurityException: ECall methods must be packaged into a system module`: when a test needs one, add it to the shim's `Externs` with its replacement, beside a test of its own in [`UnityNativeCallsTests`](../../../HallOfFame.Tests/Shim/UnityNativeCallsTests.cs); when it reads engine state (`Time.time`, `Debug.Log`), keep it out of the logic under test instead.

## What fails off-engine, and the seam to use instead

- **Logging.** `LogManager.GetLogger` needs the engine.
  Logic logs through the mod-owned [`IModLog`](../../../HallOfFame/Logging/IModLog.cs) seam, and a test hands `ModLog` a [`RecordingLog`](../../../HallOfFame.Tests/Logging/RecordingLog.cs), an `ILog` that records every call, as [`ModLogTests`](../../../HallOfFame.Tests/Logging/ModLogTests.cs) does; logic under test takes a [`FakeModLog`](../../../HallOfFame.Tests/Logging/FakeModLog.cs).
- **HTTP.** `HttpQueries`' static constructor calls `SystemInfo.deviceUniqueIdentifier` and its methods take `UnityWebRequest`: depend on `IHallOfFameApi` and inject [`FakeApi`](../../../HallOfFame.Tests/Http/FakeApi.cs), never `new HttpQueries`.
  Constructing the nested `HttpQueries.JsonError` is safe: a nested type does not trigger the enclosing type's static constructor.
- **Systems, jobs scheduled through the job system, a live world.** Test the static arithmetic they call, as above.
- **Anything reading the running game** (`GameManager.instance`, the localization manager, the UI bindings' engine): pass the value in, or put the check in game.

## Fakes

Fakes are handwritten and kept to the smallest viable shape; no mocking library is used.

- One settable delegate per method the test actually wires up.
- Every method left unwired throws `NotImplementedException` (or is a no-op for pure side effects like logging), so an unexpected call fails loudly instead of passing silently.
- An interface too wide to fake by hand gets a `DispatchProxy` recorder, as `RecordingLog` is for `ILog`.

## Floats

The game computes `float` two ways: Burst code in single precision, managed code under its Mono in double precision, narrowed to single precision each time a value is stored (a local, a field, an array element).
CoreCLR computes in single precision throughout, as Burst does: managed code the tests pass can still round otherwise in game.
The classic bug is a **read-back comparison**, a value stored, then compared with the same expression computed again: equal here, off by a rounding in game. Compare floats the main thread computes with a tolerance.

## Writing a test

- xUnit v3, `Method_Case_Expectation` names, one test class per class under test, mirrored in folders.
- Work the expected values out from the rule before the first run. When a test fails, find out which of the two is wrong before touching the expectation.
- A test that is green at once has proved nothing: put the fault it guards against back into the code (revert the fix, flip the comparison, drop the tolerance), see it fail, then restore the code.

## Where .NET differs from the game's runtime

CoreCLR is not the game's Mono: string formatting, culture-aware comparison, hash codes, code pages and a few type layouts differ.
When a result goes through any of those (text a player sees, a sort, a persisted value, a dictionary's order), read [runtime-differences.md](runtime-differences.md) and check that result in game.
