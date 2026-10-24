<!-- Version: 1.0.2 -->

# AGENTS.md

## Project overview

Hall of Fame is a C# mod for Cities: Skylines II that allows players to share and view screenshots.
This repository contains the game-side code, while the server-side code is located in a separate repository, `../HallOfFameServer` (if checked out).

## Tech stack

- [mise-en-place](https://mise.jdx.dev): manages dev tools, env vars, and tasks for this repo.
- C# 14 on `net48`, built with the CS2 modding toolchain; the mod's runtime types are Unity/ECS systems living in the game's world, and the unit tests are xUnit running off-engine.
- React 18 and TypeScript with SCSS modules, bundled, packaged and tested with bun (`HallOfFame/UI/build.ts`), formatted and linted with oxfmt/oxlint.
- The UI runs in Coherent Gameface (cohtml), not a browser: web features can be missing or behave differently, so check the `gameface` skill before relying on one.
- The csmodding plugins are a prerequisite: `coherent-gameface` (the `gameface` skills and the `game_*` MCP tools), `cs2-modding`, and `unity-devtools`. When any of them is missing from a session that touches the game, the UI, or the decompile, stop before starting work and ask the user to load it.

## Project settings

C#, same in `HallOfFame` and `HallOfFame.Tests`:

- `net48`, `LangVersion` 14, overriding the toolchain's 9.0. PolySharp polyfills what `net48` lacks.
- `Nullable` and `TreatWarningsAsErrors` enabled: fix a warning or suppress it inline with a justification.
- `ImplicitUsings` off: write every `using` explicitly.
- Never `ConfigureAwait(false)`: continuations touch ECS and cohtml bindings, so awaits resume on Unity's main thread.

TypeScript, one root `tsconfig.json` covering `HallOfFame/UI/src` and `.agents/hooks`:

- TypeScript 7.0.2, tsconfig strictest, minus `noPropertyAccessFromIndexSignature`.
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
- `HallOfFame/Utils`: Small helpers and extensions (localization, input bindings, etc.), plus `Writers/`, the outbound C# to cohtml binding writers (`IWriter<T>` implementations and the helpers they share).
- `HallOfFame/Locales`: Localization files, one JSON per language, keyed `HallOfFame.<Area>.<KEY>`, plus `Skyve/`, Skyve's own labels, keyed bare (see Guidelines).
- `HallOfFame/Mod.cs` and `HallOfFame/Settings.cs`: Mod entry point and user-facing settings.
- `HallOfFame.Tests`: C# unit tests (xUnit, `net48`, run off-engine).
- `HallOfFame/UI/src`: TypeScript/React frontend, split into `area-game` (in-game HUD panels), `area-menu` (main-menu integration), `area-overlay` (loading screen modification), `components` (UI components shared across areas), `utils` (shared hooks/helpers, plus `bindings/`, the typed C#<->TS binding facade, one module per binding group), and `vanilla-modules` (typed stubs for game UI internals).
  UI tests are colocated `*.test.ts` / `*.test.tsx` files.
- `HallOfFame/UI/cs2-types`: The game's own `cs2/*` type declarations: the `.d.ts` files of `$CSII_INSTALLATIONPATH/Cities2_Data/Content/Game/.ModdingToolchain/npx-create-csii-ui-mod/template/types`, copied as they are. Copy them again after a game update, never edit them by hand.

## Commands

- `mise build`: Build and deploy the whole mod, C# and UI both (the csproj runs `build:ui` itself). The game must be closed, since it holds the deployed assembly open. Anything outside `UI/src` needs this, locale files included.
- `mise build:ui`: Build the UI alone and deploy it to the game's Mods folder. This is the one to run while iterating with the game open: reload the UI afterwards and the change is live.
- `mise build:css-types`: Regenerate the gitignored `*.module.scss.d.ts` files. `mise check` and `mise fix` run this automatically; run it by hand if your editor needs the CSS module types refreshed.
- `mise check:agents`: Verify type checking, linting, and formatting read-only, with optimized output. Writes nothing.
- `mise check:agents:tsc`: Only type-checks the code, optimized output.
- `mise check:agents:oxlint`: Only lints the code, optimized output.
- `mise fix`: Apply the auto-fixes in place (oxlint `--fix`, oxfmt, then the C# cleanup of `fix:cs`).
- `mise fix:cs`: Format the C# code in place with jb (ReSharper) cleanupcode. There is no read-only C# check, cleanupcode has no dry-run mode.
  Run it right before each commit that touches C#, and only then, as it is slow. Files it reformats outside your change go in their own `style` commit.
- `mise dev`: Watch and rebuild the UI (bundle and CSS module types) on change.
- `mise test`: Run the full test suite, C# and UI.
- `mise test:cs`: Run only the C# unit tests.
- `mise test:ui`: Run only the UI tests.
- `mise setup:linux`: Install the modding toolchain on Linux, where the in-game installer cannot run. Idempotent, rerun it after a game update; the game must be closed.
- `mise l10n:push`: Preview which locale-file edits would be pushed to Crowdin and approved, after the source file is uploaded so new keys exist before their translations; with `--no-approve`, pushed unapproved and flagged as AI-translated instead, for machine translations a proofreader should still review. Needs `CROWDIN_PERSONAL_TOKEN`. Adding `--push` writes to the shared Crowdin project, which the Boundaries below gate.
- `mise l10n:pull`: Preview Crowdin's current translations of the source keys added or changed since `--base`, with author and date, where they differ from the locale files, or of every key with `--all`; `--write` puts them into the files. Run before translating a feature's keys, so a volunteer's pending work is kept rather than pushed over, and with `--all` before a release, since nothing else brings volunteers' work into the repo. Needs `CROWDIN_PERSONAL_TOKEN`.
- `mise l10n:skyve`: Copy Skyve's stability labels, for every locale the mod ships, into `HallOfFame/Locales/Skyve` from Skyve's repository at the commit `.agents/scripts/import-skyve-labels.ts` pins. Move the pin to pick up Skyve's newer translations.
- `mise icons:fontawesome <style> <icon>`: Download a Font Awesome 7.3.1 icon, Free or Pro (ex. `duotone-light aperture`), into `HallOfFame/UI/src/icons/fontawesome` as `<icon>-<style>.svg`, its license comment stripped. List a Pro icon in that folder's `NOTICE`.
- `mise images:optimize`: Shrink the Paradox Mods images in `HallOfFame/Properties`, previews quantized by pngquant, everything recompressed by oxipng. Idempotent.
- `mise publish:page`: Push `PublishConfiguration.xml` to the Paradox Mods page (description, tags, thumbnail, screenshots) without shipping a version; runs `images:optimize` first.
- `mise publish`: Build in Release and publish a new version on Paradox Mods.

Run `mise tasks` to see the full shortcut list; append arguments freely, mise passes them through (ex. `mise some:task --some-arg`).
Do NOT use npx to run commands; prefer mise shortcuts, or bun/bunx when no shortcut exists.

Always run the appropriate check/test commands after changes, at the end of the editing session rather than mid-flight.

## Glossary

- **Slideshow**: the main-menu screenshot rotation (`SlideshowUISystem`, `SlideshowConductor`, `area-menu`). It was once called the "presenter"; it is the slideshow everywhere now.
- **Creator**: the player account that uploaded a screenshot. The mod calls players creators, not users or authors.
- **Creator ID**: `Settings.CreatorID` is the mod's API credential, never a public identifier and never in a URL. The creator's public identifier is `Domain/Creator.Id`, persisted as `Settings.PublicCreatorID`.
- **Vanilla**: the unmodded game's own code and UI (`vanilla-modules`).
- **Area**: one `area-*` UI folder per place in the game's UI the mod hooks into: `area-game` (HUD), `area-menu` (main menu), `area-overlay` (loading screen).

## Guidelines

- Every C#↔TS binding goes through a `HallOfFame/UI/src/utils/bindings` module, which owns its `const GROUP`, keeps its `bindValue`/`trigger` calls private, and exports typed hooks and command functions. Components call those, never raw `bindValue`/`trigger`.
- Create value bindings with `lazyBindValue` (not eager `bindValue`) so that importing a module or component does not instantiate engine bindings; call the returned accessor inside the hook, e.g. `useValue(foo$())`.
- Domain records carry only inbound `[DecodeAlias]` data: a type's outbound UI wire format lives in a `HallOfFame/Utils/Writers` writer, not on the record. A writer whose properties vary between writes encodes which are present in its `TypeBegin` name, as `ScreenshotValueWriter` does: cohtml caches one shape per type name and crashes the game on another (`gameface` skill, data binding).
- One `*.module.scss` per component file, colocated with its `*.tsx`, class names following the BEM-derived convention in `.agents/rules/css-modules-bem.md`.
- Every layout length is in `rem` or `em`, which scale with the viewport: `px` is only correct at 1920 wide, where `1rem` happens to equal `1px`, and drifts both ways at every other resolution.
- SCSS reaches a vanilla color only through its `vanilla.$…` variable in `HallOfFame/UI/src/vanilla-vars.scss`, never a raw `var(--…)`: add a missing one there with its latest known value in a trailing comment, so a game update that moves a color shows in one file.
- Tooltips come from `HallOfFame/UI/src/components/tooltip.tsx`, never from `cs2/ui`: the vanilla one silently drops `direction` and `alignment`, so every tooltip placed through it opens upwards.
- Focus keys are compared by value, so a plain string like `` `mod-${mod.id}` `` keeps a list row attached across re-renders, where a `FocusSymbol` memoized per row costs more for the same result.
- A `vanilla-modules` stub may declare more of the vanilla API than the mod calls today: its unused members are kept on purpose, for the next consumer.
- User-facing strings are localized: add keys to `HallOfFame/Locales/en-US.json` and translate a mod key with no fallback, the other locale files are translations pulled from Crowdin. A feature stays open until every locale file holds a translation of each key it added or changed, pushed through `mise l10n:push`:
  - A feature's keys go through the `hof-translate` skill: it pulls the volunteers' pending Crowdin work first, then translates, cross-reviews and previews the push.
  - Approved (`--push`) for a feature's keys in a locale volunteers translate, and for fixes to volunteer strings: a pull brings back Crowdin's approved version over an unapproved one.
  - Unapproved and AI-flagged (`--no-approve --push`) for a locale with no volunteer translations, and for older keys a partial locale never had, so proofreaders still review them.
  - The Crowdin GitHub integration is off: nothing moves between Crowdin and the repo but `mise l10n:push`, which carries the source and the repo's translations out, and `mise l10n:pull`, which brings volunteers' work in.
  - The script diffs `--base` against the working tree, so run each mode from a tree holding only that mode's edits.
- `HallOfFame/Locales/Skyve` holds Skyve's own labels, registered under `HallOfFame.Skyve.`: it stays out of Crowdin and `mise l10n:push`, and changes only through `mise l10n:skyve`.
- The decompiled game source, the third-party mod corpus, and the readable copy of the game's UI bundle are machine-local: read their paths from `~/.cs2-modding/setup.md` instead of hardcoding them here. A missing key or a `(none)` value means that source does not exist.
- Reading that source settles what the engine does, never what it costs. Measure a claim about the running game before asserting one.
- To put a given screenshot on screen in the running game, load it by ID with `SlideshowUISystem.LoadScreenshotById` (debug builds), through the unity-devtools `eval` tool: `world.GetOrCreateSystemManaged<HallOfFame.Systems.SlideshowUISystem>().LoadScreenshotById("<id>")`.
- To preview a new or changed locale string in the running game without a `mise build`, push it into the live dictionary through the unity-devtools `eval` tool, then raise the change event the UI listens to; it holds until the game restarts, so the edit still goes into `en-US.json`:
  `var lm = Game.SceneFlow.GameManager.instance.localizationManager; lm.activeDictionary.Add("<key>", "<value>", false); typeof(Colossal.Localization.LocalizationManager).GetMethod("NotifyActiveDictionaryChanged", (System.Reflection.BindingFlags)36).Invoke(lm, null)`.
- The toolchain's `CSII_*` variables are Windows user-scope environment variables, a scope Linux lacks: read one from the user scope with a process-environment fallback, the shape `HallOfFame.csproj` and `HallOfFame.Tests.csproj` use.
- When writing or running C# tests, debugging an engine-bound type that won't load off-engine, or deciding where to put logic so it stays testable, use the `hof-cs-offengine-testing` skill.
- When writing or running UI tests, configuring bindings or asserting triggers in a test, or fixing the harness after a game update, use the `hof-ui-testing` skill.
- When reviewing or editing the Paradox Mods preview images (`Previews.af`), read `docs/agents/paradox-mods-previews.md` first: palette, type scale, margins, and the deliberate design choices a review leaves alone.

## Boundaries

Never:

- Create a git branch or commit work yourself unless the user expressly said so.
- Commit secrets, tokens, `.env` files, dumps, credentials.
- Modify generated files unless the generation command was run.

Ask first before:

- Adding a dependency.
- Changing the HTTP wire format shared with the server, or the bindings wire format shared with the UI.
- Performing destructive file or data operations.
- Running `mise l10n:push --push`, in either mode. It writes to the shared Crowdin project: by default it approves translations, which stamps a proofreading verdict volunteer translators see and cannot easily undo, and `--no-approve` adds them unapproved, for volunteers to review. Preview first, and keep `--base` to the commits you wrote: a base reaching back across a pull commit pushes volunteers' translations as though they were yours.
- Running `mise publish` or `mise publish:page`: both write to the live Paradox Mods page every player sees.

## Preferred agent behavior

- Start by inspecting existing patterns.
- Prefer LSP over Grep/Glob/Read for code navigation.
- Make the smallest safe change, but speak up when a refactor is overdue.
- When uncertain, state the assumption and proceed conservatively.
- Actively propose updates to `AGENTS.md`, comments, or other docs when you detect drift.
- Where a spec contradicts a design iterated with the user in the running game, the design stands: annotate the spec with it, without asking.
