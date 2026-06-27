# Game UI test harness internals

`HallOfFame/UI/src/testing/game-setup.ts` is a `bun test` preload (wired in `bunfig.toml`) that
loads the real Cities: Skylines II UI bundle so component tests render against the real `cs2/*`
modules. Read this when a game update breaks it, or when changing what the harness mocks. The file's
own comments are the authority; this is the map.

## How it loads the bundle

1. It reads the minified webpack bundle from
   `$CSII_INSTALLATIONPATH/Cities2_Data/Content/Game/UI/index.js`.
2. `cs2/*` are ambient TYPE-only declarations in this repo (`@csmodding/urbandevkit/cs2-types`); the
   real runtime implementations live only in that bundle.
3. bun cannot `import()` the bundle (its hot-reload setters reassign `const` bindings, which bun's
   transpiler rejects), so the source is handed to JavaScriptCore via indirect `eval`.
4. The bundle exposes each game module on `window` (e.g. `window['cs2/api']`); each bare specifier
   is aliased to its window export with `mock.module`. react and react-dom are intentionally NOT
   aliased this way (see below).

## React injection (the anchors that drift)

For mod components, game components, and `@testing-library/react` to share ONE React instance, the
bundle's two thin react wrapper modules are string-replaced before eval so they export this repo's
pinned react@18.3.1 (`reactInjectionPatches` in `game-setup.ts`). Those two string **anchors** are
minified module ids and WILL change on a game update; the preload then throws "React injection
anchor not found".

To re-discover them after a game update:

- Open the bundle at the path above and find the two tiny webpack modules that re-export react and
  react/jsx-runtime, of the shape `<id>:(e,t,n)=>{"use strict";e.exports=n(<dep>)}`.
- The react one re-exports the module whose body is the react package; the jsx one re-exports
  react/jsx-runtime. Replace each `e.exports=n(<dep>)` with `e.exports=globalThis.__TEST_REACT__`
  and `e.exports=globalThis.__TEST_JSX__` respectively, keeping the `<id>:` prefix intact.
- Ask the user for guidance identifying the modules if the minified shape is ambiguous.

react is injected this way rather than through `mock.module` because aliasing react via `mock.module`
makes react-dom bind to a spread copy and silently no-op on commit.

## The mock engine

The bundle talks to C# through a cohtml `engine` global the harness defines before load. Defining it
first flips the bundle to its "attached" mode, and a no-op `BindingsReady` keeps the app's
`whenReady` from firing so it never auto-boots and only test trees render.

The engine answers `*.subscribe` / `*.subscribeMapEntry` requests synchronously from the values
configured via `setBinding` / `setMapBinding` (an unconfigured value binding is left at its
`bindValue` default; an unconfigured map entry resolves to `null`), and records every other
`trigger` as a command for `getTriggers()`. `overrideLocalization()` repoints the
`LocalizationContext` no-provider default so `translate(id, fallback)` returns the fallback or the
id without the real, binding-driven localization provider.
