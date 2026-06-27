# AGENTS.md

## Project overview

Hall of Fame is a C# mod for Cities: Skylines II that allows players to share and view screenshots.
This repository contains the game-side code, while the server-side code is located in a separate
repository.

## Repository structure

A Cities: Skylines II mod consists of two main parts:

- The mod's UI is located in `HallOfFame/UI/src` and is made of React components hooking onto the
  game's React UI.
- The mod's logic and UI bindings are located in other folder in `HallOfFame` and implemented in C#.

Here is a more detailed breakdown:

- `HallOfFame/Domain`: Data model classes (e.g. `Screenshot`, `Creator`, `Like`, `View`)
  representing the entities exchanged with the server.
- `HallOfFame/Http`: HTTP client layer — `HttpQueries.cs` and its partial classes handle all API
  calls (fetching screenshots, uploading, liking, reporting, etc.).
- `HallOfFame/Systems`: ECS-style UI systems that drive the mod's runtime behavior (presenting
  screenshots, capturing them, preloading images, etc.).
  The `Capture/` subfolder holds the capture system (`CaptureUISystem`) plus its engine-bound
  collaborators (`ScreenshotCapturer`, `CitySnapshotProvider`).
- `HallOfFame/Services`: Plain (non-ECS) classes holding logic generally extracted from systems.
- `HallOfFame/Reflection`: Proxy/accessor classes that reach into private game internals via
  reflection (e.g., screen utilities, error dialogs, Paradox SDK platform).
- `HallOfFame/Logging`: The mod-owned logging seam (`IModLog` + `ModLog`) used through `Mod.Log`,
   wrapping the engine's `Colossal.Logging.ILog` so logging logic stays unit-testable off-engine.
- `HallOfFame/Utils`: Small helpers and extensions (localization, logging, input bindings, etc.).
- `HallOfFame/Utils/Writers`: Outbound C# to cohtml UI-binding writers (`IWriter<T>`
  implementations). Domain records carry only inbound `[DecodeAlias]` data, so each type's outbound
  UI wire format lives here, not on the record.
- `HallOfFame/UI/src`: TypeScript/React frontend, split into `area-game` (in-game HUD panels),
  `area-menu` (main-menu integration), `area-overlay` (loading screen modification), `utils`
  (shared hooks/helpers), and `vanilla-modules` (typed stubs for game UI internals).
- `HallOfFame/Mod.cs` and `HallOfFame/Settings.cs`: Mod entry point and user-facing settings.

## Decompiled game sources and retro-engineering

Use this when you require more knowledge about the game's internals, either for implementing
features or answering questions:

- C#: You may find the game's decompiled C# code outside of this repository, in
  `../DecompiledCitiesSkylines2`.
- UI: You can find the (minified) game's UI code in the `HallOfFame/UI/vanilla-modules.source.js`
  file.

As you will have limited knowledge of the game's UI and inner workings, ask the user for guidance
when you need to know what's what in the game from the source.

Store things learned from the user or from the game's sources in your memory.

## Commands

Do NOT use `npx` to run commands, always prefer `mise` or `bun`.

- `bun run build`: Check that the UI part of the mod compiles fine.
- `bun check`: Run type checking with tsc, and linting with Biome, performing safe fixes.
  Always run this command after modifying UI code.

## Testing (C#)

Unit tests live in the `HallOfFame.Tests` project and run with xUnit.

- `mise run test:cs`: Run the C# unit tests. It passes `-p:SkipBuildUI=true` so the TypeScript UI
  is not rebuilt on every run.
- Tests target `net48` like the mod, so they can reference the same game assemblies.
- Game assemblies (Colossal, Unity) are referenced for compilation only and loaded at runtime by an
  `AssemblyResolve` probe pointing at the game's `Managed` folder (see `GameAssemblyResolver`), so
  no game binaries are copied into the test output.
- ECS systems (`Systems/`) cannot be instantiated off-engine; extract product logic there to make it
  testable.

## Boundaries

- Never commit work yourself unless the user expressly told you so.
- Never modify generated files unless the generation command was run.
- Never reformat unrelated files.
- Ask before adding a dependency.
- Ask before reworking architecture.
- Ask before performing destructive file or data operations.

## Preferred agent behavior

- **Prefer LSP over Grep/Glob/Read for code navigation**.
- Start by inspecting existing patterns.
- NEVER use em dashes (—) in comments, docblocks, and docs, when you see one, remove it.
- Respect a strict 100-character line length limit, comments included (include docblock formatting
  in the count). One-line lint suppression comments are exempt from this limit.
- Update `AGENTS.md` or docs under `docs/` to keep them up to date or when you notice a pattern.
- Make the smallest safe change — BUT SPEAK UP if you think a refactor is overdue.
- Prefer editing existing files over creating parallel abstractions.
- When uncertain, state the assumption and proceed conservatively.
