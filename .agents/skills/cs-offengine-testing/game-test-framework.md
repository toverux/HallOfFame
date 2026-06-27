# The game's in-engine test framework

Cities: Skylines II tests itself with a proprietary **in-engine** framework, `Colossal.TestFramework`
(not xUnit/NUnit/MSTest, and not the Unity Test Framework). None of it is reachable from our
off-engine `net48` xUnit project, so this is background only, kept to explain why we test the way we
do.

How it works:

- Tests subclass `TestScenario : ITestStep`, with `[TestDescriptor]` on the class and
  `[Test]`/`[TestPrepare]`/`[TestCleanup]` methods (sync or async), discovered by reflection.
- Pass/fail is **log-driven**: any error or exception logged during a test fails it
  (`TestScenario.cs:261-276`). Assertions live in `Colossal.Assertions/Assert.cs`, including
  `Logs<T>` / `LogContains`.
- It targets `net40`, project-references the whole `Game.csproj` graph, and runs inside a
  fully-booted game under `qaDeveloperMode`, orchestrated by an external "DryDock" tool over named
  pipes / TCP.
- There is no synthetic test ECS `World` and no off-engine harness: system tests only touch the live
  `World.DefaultGameObjectInjectionWorld` via `GetExistingSystemManaged<T>()`. Their "unit" tests
  exercise plain structs and Burst jobs directly (e.g. `MaxFlowSolver`, `SunMoonData`), bypassing
  `SystemBase`.

Source: `../DecompiledCitiesSkylines2/src/Colossal.TestFramework/` and `.../Game.TestScenarios/`.

**Takeaway.** Its all-or-nothing engine binding is exactly why we extract logic out of `Systems/`
into plain `Services/` and test those off-engine. Two cheap ideas worth re-implementing ourselves
(not referencing): a fail-on-unexpected-error log sink, and a `Logs<T>` / `LogContains`-style log
assertion helper.
