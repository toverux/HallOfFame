---
date: 2026-10-24
area: UI/build
symptoms:
  - '`performance.now()` reads the same value before and after the module evaluates'
  - '`register()` runs ~9 s after the module evaluated, during boot'
  - 'The same reload measured twice differs by more than the change under test'
tags: [performance, measurement, harmony, cdp, profiler, boot, cohtml]
---

# Measuring the UI bundle's load cost

## Problem

Timing what the mod's UI costs at game load from inside the page reports nothing usable, and
reload-to-reload noise swamps a difference of tens of milliseconds.

## What didn't work

- `performance.now()` marks in the bundle: Cohtml freezes it for the whole frame, so evaluation and
  `register()` both read 0 ms (`gameface-quirks.md`); `Date.now()` advances, at 1 ms resolution.
- In-page spans during boot: the UI view advances about once per second until the main menu, and
  each async step of the game's mod loader (`import()`, the CSS XHR, the `<link>` load) takes one
  tick, so the module evaluates ~9 s before its registrar runs, though neither waits on the other.
- Hiding the mod's UI by moving files: a Paradox Mods copy of the mod in the playset registers the
  same `coui://ui-mods/HallOfFame.mjs`, and the game serves that one instead.
- Comparing variants batch after batch: the same build's reload cost drifted ~10% over a session,
  and the first reload after swapping a deployed file runs about twice as long as the next ones.

## Fix

Time the main thread from C# and compare interleaved variants:

- Harmony prefix and postfix on `Colossal.UI.UIManager.Update` with a `Stopwatch`: it covers JS,
  style, and resource work for every view, once per frame. Record per frame, write a CSV per window.
- Boot without the UI: a Harmony prefix on `Game.UI.AppBindings.AddActiveUIModLocation` dropping the
  mod's path from its `ref IList<string>` argument. In a running game,
  `appBindings.RemoveActiveUIModLocation` from the unity-devtools `eval`, the list built as
  `System.Text.RegularExpressions.Regex.Split("<path>", ";")` (the grammar has no collection
  initializer).
- Decompose by swapping the deployed files between reload batches: a stub module
  (`export default function(){};export const hasCSS=false;`) for "no mod", a registrar returning at
  once for parse and evaluation only, a one-rule stylesheet for "no CSS". Interleave the variants
  over several rounds, reload every 10 s from a CDP client, and drop each batch's first reload.
- Attribute JS with the CDP `Profiler` domain on `ws://localhost:9444/devtools/page/0` (`enable`,
  `setSamplingInterval`, `start`, reload, `stop`): the profile survives the reload and names each
  frame's script.

## Prevention

Pin the CPU clock before measuring, compare only variants interleaved within one sitting, and read a
boot run's menu phase (its first second, its worst frame) apart from the boot phase, where the UI's
work hides in one-second ticks.
