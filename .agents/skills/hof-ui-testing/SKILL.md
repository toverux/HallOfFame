---
name: hof-ui-testing
description: Write and run the mod's UI tests with bun. Use when writing or running a UI test, when a component test must render against the real game bundle, when configuring bindings or asserting triggers in a test, or when the harness fails to load the game bundle after a game update.
---

# UI testing

The mod's UI tests run under `bun test` and come in two tiers, set apart by one fact: a **component test** renders real mod components against the **real, prebuilt game UI bundle** loaded into the test process, while a **pure-logic test** imports only TYPES from `cs2/*` and the binding modules, which bun erases, so it runs bare (no DOM, no game install).
Everything below follows from that split.

Tests are colocated `*.test.ts` / `*.test.tsx` files next to the code they cover.

## Run

```
mise test:ui
```

For a focused run during TDD, call `bun test <path>` directly; the `bunfig.toml` preload still applies.
Run `mise check` after, like any UI change.

## The two tiers, and where logic goes

- A **pure-logic test** is the cheap default.
  It needs no bundle and no game, so it runs anywhere.
  Keep extractable logic in a **type-only module** (one whose `cs2/*` and binding imports are all `import type`) so it stays in this tier.
  Inject the collaborators the logic would otherwise reach for: pass a `translate` that echoes its id back rather than importing the real localization.
- A **component test** renders a real component with `@testing-library/react`.
  Reach for it only when the behaviour lives in the rendered tree: a binding drives the DOM, or a click must fire a command.
  It depends on the game bundle, so it fails wherever the bundle is absent (see Best-effort loading).

## Writing a component test

Drive the component through the mock engine exported by [`testing/game-setup.ts`](../../../HallOfFame/UI/src/testing/game-setup.ts):

- `setBinding(group, name, value)` BEFORE `render` configures what a `bindValue(group, name, default)` returns; called after, it updates the subscribed components, so wrap it in `act`.
  An unconfigured binding keeps its `bindValue` default; a default-less binding throws, which is the intended "you forgot to configure this" signal.
  The harness itself answers the game bindings vanilla controls read with no default: the tutorial ones every vanilla tutorial target (a `Tab`, for one) reads, a `TextInput`'s input barrier, and the glyph and keyboard-layout options a key's icons read.
- `setMapBinding(group, name, key, value)` configures one MapEntry binding (e.g. `cs2/ui` input hints); unconfigured entries resolve to `null`, which is enough for game widgets to render.
- `setTranslations({ id: text })` sets what `translate` returns for an id. Without it, `translate(id, fallback)` returns the fallback, or the id when none is given, so a rendered label's text is its localization id; match on that. A string with `{PLACEHOLDER}` arguments needs its translation set, or the arguments are dropped.
- `getTriggers()` returns the outbound command triggers (`{ event, args }`) recorded since the last reset.
  Assert on these instead of mocking the binding layer.
- `getUsageEvents()`, from `testing/usage-events.ts`, returns the `[name, properties]` of each `trackUsage` call since the last reset, for asserting usage events.
- `emitEvent(name, ...args)` sends the UI an event the game would, calling every handler the bundle registered for it.
  An event binding listens on its name suffixed with `.update`: an input action is `emitEvent('input.onActionPerformed.update', { action: 'Back', value: null })`, delivered only to consumers inside an `EventInputProvider` from `cs2/input`, which reads the `input.actionNames` binding.
- `resetBindings()` clears configured bindings, translations and recorded triggers; call it in `afterEach` alongside `@testing-library/react`'s `cleanup()`.
- A tooltip renders here: its balloon portals into `document.body`, so a test finds its content by text. The balloon leaves through an exit transition, so assert it hidden inside `waitFor`, as [`tooltip.test.tsx`](../../../HallOfFame/UI/src/components/tooltip.test.tsx) does. A `wheel` holds every tooltip closed until a `mousemove`: end a test that dispatches one on a move.
- A CSS module class is invisible too: a `*.module.scss` import resolves to the file's path, so every `styles.*` reads `undefined`. Assert on roles, text and vanilla classes, or expose a state the test checks as a `data-*` attribute.
- State a component shares at module level (a singleton hook) outlives a test's render: reset it in `afterEach`.

See `panel-city-info.test.tsx` for a binding-driven render and `panel-footer.test.tsx` for a click-fires-a-trigger assertion.

## In the running game

Check live what a component test cannot show (layout, tooltips, transitions, native input) with the gameface `game_*` tools, faking the data from `game_eval` rather than setting up a city that has it:

- Patch a field of the slideshow's screenshot: `engine.trigger('hallOfFame.slideshow.screenshot.patch', ['description'], 'A **city**.')`.
- Set any value binding: `engine.trigger('<group>.<name>.update', value)`, e.g. `hallOfFame.slideshow.loadError`.
- Send an input action `game_key` cannot reach, such as Back: `window['cs2/input'].onInputActionPerformed$.onUpdate({ action: 'Back', value: null })`.
- Reach a mod element by its stable class: `[class*="hof-<block>-<element>_"]`.

A fake lasts until the game updates that binding or the UI reloads.
For a state that must survive reloads, drive the C# side to it instead, through the mod's Debug entry points from the unity eval: `world.GetExistingSystemManaged<HallOfFame.Systems.SlideshowUISystem>().LoadScreenshotById("<id>")` loads a real screenshot.
When no screenshot has the state you need, edit one into it: the local dev database (`mongodb://localhost/halloffame`, started by `mise dev:db:start` in `../HallOfFameServer`) is throwaway and free to edit.
To see another creator's collection, log in as them: the server matches a login by Creator ID, name or slug, so move your own record's `creatorId`, `creatorName` and `creatorNameSlug` aside, then give theirs the Creator ID your mod settings send. The login renames their record to your name, so restore both records afterwards.

## Best-effort loading and harness repair

The bundle is loaded by the `game-setup.ts` preload (wired in `bunfig.toml`), reading the game from `CSII_INSTALLATIONPATH`.
Loading is best-effort: if the game is not installed, or the two React injection **anchors** in `game-setup.ts` **drift** after a game update, only component tests fail (with a clear "anchor not found" message); pure-logic tests are untouched.

When a game update breaks the harness, or you need to understand how it injects React and aliases the `cs2/*` modules, read [harness-internals.md](harness-internals.md).
