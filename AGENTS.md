<!-- Version: 1.0.2 -->

# AGENTS.md

## Project overview

Hall of Fame is a C# mod for Cities: Skylines II that allows players to share and view screenshots.
This repository contains the game-side code, while the server-side code is located in a separate repository, `../HallOfFameServer` (if checked out).

## Tech stack

- [mise-en-place](https://mise.jdx.dev): manages dev tools, env vars, and tasks for this repo.
- C# 14 on `net48`, built with the CS2 modding toolchain; the mod's runtime types are Unity/ECS systems living in the game's world, and the unit tests are xUnit running off-engine.
- React 18 and TypeScript with SCSS modules, bundled by webpack, packaged and tested with bun, formatted and linted with oxfmt/oxlint.
- The UI runs in Coherent Gameface (cohtml), not a browser: web features can be missing or behave differently, so check the `gameface` skill before relying on one.

## Project settings

C#, same in `HallOfFame` and `HallOfFame.Tests`:

- `net48`, `LangVersion` 14, overriding the toolchain's 9.0. PolySharp polyfills what `net48` lacks.
- `Nullable` and `TreatWarningsAsErrors` enabled: fix a warning or suppress it inline with a justification.
- `ImplicitUsings` off: write every `using` explicitly.
- Never `ConfigureAwait(false)`: continuations touch ECS and cohtml bindings, so awaits resume on Unity's main thread.

TypeScript, one root `tsconfig.json` covering `HallOfFame/UI/src` and `.agents/hooks`:

- TypeScript 6.0.3, tsconfig strictest, minus `noPropertyAccessFromIndexSignature`.
- `verbatimModuleSyntax` off, `isolatedModules` on.
- The bundle runs in Coherent Gameface; tests and hooks run under bun with happy-dom.

## Repository structure

A Cities: Skylines II mod has two halves talking over cohtml bindings: the C# logic in `HallOfFame`, and the React UI in `HallOfFame/UI/src` hooking onto the game's own React UI.

- `HallOfFame/Domain`: Data models exchanged with the server (`Screenshot`, `Creator`, `Like`, `View`).
- `HallOfFame/Http`: HTTP client layer, `HttpQueries.cs` and its partial classes, holding every API call.
- `HallOfFame/Systems`: ECS-style UI systems driving the mod's runtime behavior.
  `Capture/` holds `CaptureUISystem` plus its engine-bound collaborators (`ScreenshotCapturer`, `CitySnapshotProvider`).
- `HallOfFame/Services`: Plain (non-ECS) classes holding logic extracted from systems.
- `HallOfFame/Reflection`: Proxy/accessor classes reaching into private game internals via reflection (screen utilities, error dialogs, Paradox SDK platform).
- `HallOfFame/Logging`: The mod-owned logging seam (`IModLog` + `ModLog`, reached through `Mod.Log`) wrapping the engine's `Colossal.Logging.ILog` so logging logic stays unit-testable off-engine.
- `HallOfFame/Utils`: Small helpers and extensions (localization, input bindings, etc.), plus `Writers/`, the outbound C# to cohtml binding writers (`IWriter<T>` implementations).
- `HallOfFame/Locales`: Localization files, one JSON per language, keyed `HallOfFame.<Area>.<KEY>`.
- `HallOfFame/Mod.cs` and `HallOfFame/Settings.cs`: Mod entry point and user-facing settings.
- `HallOfFame.Tests`: C# unit tests (xUnit, `net48`, run off-engine).
- `HallOfFame/UI/src`: TypeScript/React frontend, split into `area-game` (in-game HUD panels), `area-menu` (main-menu integration), `area-overlay` (loading screen modification), `utils` (shared hooks/helpers, plus `bindings/`, the typed C#<->TS binding facade, one module per binding group), and `vanilla-modules` (typed stubs for game UI internals).
  UI tests are colocated `*.test.ts` / `*.test.tsx` files.

## Commands

- `mise build`: Check that the UI part of the mod compiles fine.
- `mise build:css-types`: Regenerate the gitignored `*.module.scss.d.ts` files. `mise check` and `mise fix` run this automatically; run it by hand if your editor needs the CSS module types refreshed.
- `mise check:agents`: Verify type checking, linting, and formatting read-only, with optimized output. Writes nothing.
- `mise check:agents:tsc`: Only type-checks the code, optimized output.
- `mise check:agents:oxlint`: Only lints the code, optimized output.
- `mise fix`: Apply the auto-fixes in place (oxlint `--fix`, oxfmt, then the C# cleanup of `fix:cs`).
- `mise fix:cs`: Format the C# code in place with jb (ReSharper) cleanupcode. There is no read-only C# check, cleanupcode has no dry-run mode.
- `mise dev`: Watch and rebuild the UI (webpack bundle and CSS module types) on change.
- `mise test`: Run the full test suite, C# and UI.
- `mise test:cs`: Run only the C# unit tests.
- `mise test:ui`: Run only the UI tests.

Run `mise tasks` to see the full shortcut list; append arguments freely, mise passes them through (ex. `mise some:task --some-arg`).
Do NOT use npx to run commands; prefer mise shortcuts, or bun/bunx when no shortcut exists.

Always run the appropriate check/test commands after changes, at the end of the editing session rather than mid-flight.

## Glossary

- **Slideshow**: the main-menu screenshot rotation (`SlideshowUISystem`, `SlideshowConductor`, `area-menu`). It was once called the "presenter"; it is the slideshow everywhere now.
- **Creator**: the player account that uploaded a screenshot. The mod calls players creators, not users or authors.
- **Vanilla**: the unmodded game's own code and UI (`vanilla-modules`).
- **Area**: one `area-*` UI folder per place in the game's UI the mod hooks into: `area-game` (HUD), `area-menu` (main menu), `area-overlay` (loading screen).

## Guidelines

- Every C#↔TS binding goes through a `HallOfFame/UI/src/utils/bindings` module, which owns its `const GROUP`, keeps its `bindValue`/`trigger` calls private, and exports typed hooks and command functions. Components call those, never raw `bindValue`/`trigger`.
- Create value bindings with `lazyBindValue` (not eager `bindValue`) so that importing a module or component does not instantiate engine bindings; call the returned accessor inside the hook, e.g. `useValue(foo$())`.
- Domain records carry only inbound `[DecodeAlias]` data: a type's outbound UI wire format lives in a `HallOfFame/Utils/Writers` writer, not on the record.
- One `*.module.scss` per component file, colocated with its `*.tsx`, class names following the BEM-derived convention in `.agents/rules/css-modules-bem.md`.
- User-facing strings are localized: add keys to `HallOfFame/Locales/en-US.json`, the other locale files are translations synced from Crowdin.
- The decompiled game source, the third-party mod corpus, and the readable copy of the game's UI bundle are machine-local: read their paths from `~/.cs2-modding/setup.md` instead of hardcoding them here. A missing key or a `(none)` value means that source does not exist.
- When writing or running C# tests, debugging an engine-bound type that won't load off-engine, or deciding where to put logic so it stays testable, use the `hof-cs-offengine-testing` skill.
- When writing or running UI tests, configuring bindings or asserting triggers in a test, or fixing the harness after a game update, use the `hof-ui-testing` skill.

## Boundaries

Never:

- Create a git branch or commit work yourself unless the user expressly said so.
- Commit secrets, tokens, `.env` files, dumps, credentials.
- Modify generated files unless the generation command was run.

Ask first before:

- Adding a dependency.
- Changing the HTTP wire format shared with the server, or the bindings wire format shared with the UI.
- Performing destructive file or data operations.

## Preferred agent behavior

- Start by inspecting existing patterns.
- Prefer LSP over Grep/Glob/Read for code navigation.
- Make the smallest safe change, but speak up when a refactor is overdue.
- When uncertain, state the assumption and proceed conservatively.
- Actively propose updates to `AGENTS.md`, comments, or other docs when you detect drift.
