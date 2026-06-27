---
name: ui-testing
description: Write and run the mod's UI tests with bun (pure-logic tests and React component tests). Use when writing or running UI tests, when a component test must render against the real game bundle / cs2/* modules, when configuring value bindings or asserting outbound triggers in a test, or when the game bundle fails to load / react injection anchors drift after a game update.
---

# UI Testing

The mod's UI tests run under `bun test` and come in two tiers, set apart by one fact: a **component
test** renders real mod components against the **real, prebuilt game UI bundle** loaded into the
test process, while a **pure-logic test** imports only TYPES from `cs2/*` and `bindings`, which bun
erases, so it runs bare (no DOM, no game install). Everything below follows from that split.

Tests are colocated `*.test.ts` / `*.test.tsx` files next to the code they cover.

## Run

```
mise test:ui
```

This runs `bun test HallOfFame/UI`. For a focused run during TDD, call `bun test <path>` directly;
the `bunfig.toml` preload still applies. Run `bun check` after, like any UI change.

## The two tiers, and where logic goes

- A **pure-logic test** is the cheap default. It needs no bundle and no game, so it runs anywhere.
  Keep extractable logic in a **type-only module** (one whose `cs2/*` / `bindings` imports are all
  `import type`) so it stays in this tier. Inject the collaborators the logic would otherwise reach
  for: pass a `translate` that echoes its id back rather than importing the real localization.
  (See `screenshot-upload-panel-utils.test.ts`.)
- A **component test** renders a real component with `@testing-library/react`. Reach for it only
  when the behavior lives in the rendered tree: a binding drives the DOM, or a click must fire a
  command. It depends on the game bundle, so it fails wherever the bundle is absent (see
  Best-effort loading).

## Writing a component test

Drive the component through the mock engine exported by `../testing/game-setup`:

- `setBinding(group, name, value)` BEFORE `render` configures what a `bindValue(group, name,
  default)` returns. An unconfigured binding keeps its `bindValue` default; a default-less binding
  throws, which is the intended "you forgot to configure this" signal.
- `setMapBinding(group, name, key, value)` configures one MapEntry binding (e.g. `cs2/ui` input
  hints); unconfigured entries resolve to `null`, which is enough for game widgets to render.
- `getTriggers()` returns the outbound command triggers (`{ event, args }`) recorded since the last
  reset. Assert on these instead of mocking the binding layer.
- `resetBindings()` clears configured bindings and recorded triggers; call it in `afterEach`
  alongside `@testing-library/react`'s `cleanup()`.
- `useLocalization().translate(id, fallback)` returns the fallback, or the id when none is given,
  so a rendered label's text is its localization id; match on that.

See `panel-city-info.test.tsx` for a binding-driven render and `panel-footer.test.tsx` for a
click-fires-a-trigger assertion.

## Best-effort loading and harness repair

The bundle is loaded by the `game-setup.ts` preload (wired in `bunfig.toml`), reading the game from
`CSII_INSTALLATIONPATH`. Loading is best-effort: if the game is not installed, or the two react
injection **anchors** in `game-setup.ts` **drift** after a game update, only component tests fail
(with a clear "anchor not found" message); pure-logic tests are untouched.

When a game update breaks the harness, or you need to understand how it injects react and aliases
the `cs2/*` modules, read [harness-internals.md](harness-internals.md).
