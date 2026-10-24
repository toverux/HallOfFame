---
date: 2026-10-24
status: accepted
area: UI/build
---

# No startup-performance work on the UI bundle

## Context

The game loads every mod's `.mjs` and `.css` once the mod list reaches the UI, during boot, while
the UI view advances about once per second and the game loads its prefabs; nothing waits on it, and
the main menu first renders a dozen seconds later.

Measured on Cities: Skylines II 1.6.2f1, CPU pinned at 2.0 GHz, timing `UIManager.Update` with and
without the mod's UI:

- Boot, mod list to main menu: about +25 ms of UI work, the menu reached no later.
- Main menu: its first frame +35 ms (about 100 to 135 ms), one extra frame of 45 ms as the slideshow
  shows its screenshot, about +100 ms over the first 20 s.
- Per load, from UI reloads: about +110 ms, of which ~35 ms parse and evaluation, no measurable CSS
  cost, and ~80 ms registration and first render, the slideshow costing ~30 ms more than the vanilla
  backdrop it replaces. No JS function stands out: the largest is the module's top level, ~11 ms.

Three changes were live: code-splitting the details window, creator dashboard, screenshot form,
upload panel and `ufuzzy` off the startup path (about half the bundle, at most ~15 ms, almost all of
it spent in boot ticks nobody sees); computing only the details row's flags until the details window
opens (~2–3 ms per screenshot shown); trimming the stylesheet (nothing to gain).

## Decision

The UI bundle gets no work aimed at startup performance: its load costs a tenth of a second of main
thread spread across boot, and each change on offer saves a few milliseconds for added build or code
complexity.

## Consequences

- The bundle stays one module and one stylesheet, and `selectScreenshotDetails` keeps computing the
  whole details for the row.
- Revisit when the bundle or the menu's first render grows by a multiple, or when the game starts
  gating its UI on mod loading; `docs/solutions/measuring-the-ui-bundles-load-cost.md` is how to
  measure again.
