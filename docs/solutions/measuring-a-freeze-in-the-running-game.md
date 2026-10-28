---
date: 2026-10-29
area: UI/runtime
symptoms:
  - 'The UI stops for seconds when a panel opens, then shows its content at once'
  - 'A span timed with `performance.now()` inside one handler reads 0 ms'
  - 'A second measurement of the same action shows no freeze'
tags: [performance, measurement, freeze, cohtml, unity-devtools, cdp]
---

# Measuring a freeze in the running game

## Problem

A long frame in the running game may come from C# (an HTTP decode, a binding write) or from the UI
(React, layout), and timing it from the page alone cannot tell which.

## What didn't work

- `performance.now()` spans inside a handler or a React commit: Cohtml freezes it for the whole
  task (`gameface-quirks.md`); time a span inside one task with `Date.now()`.
- Measuring the same action twice: `PlaysetLoader` keeps a loaded playset for the session, so only
  the first open of a screenshot's Playset tab is cold, and the details window, while open,
  re-requests its own screenshot's playset over any other one asked for.
- One `game_eval` that runs the action and waits for it: it times out after 15 s, and the script
  keeps running in the page.

## Fix

- From `game_eval`, install a recorder on `window`: a `requestAnimationFrame` loop pushing every
  frame over 100 ms with its end time, an `engine.on('<group>.<name>.update', …)` listener stamping
  when the binding lands in JS, and a `MutationObserver` stamping when the result reaches the DOM.
  Reset it, act with `game_click`, `game_wait` on its marks, then read it in its own call.
- Isolate C# by calling the work alone from the unity-devtools `eval` while the recorder runs (ex.
  `HallOfFame.Mod.Api.GetPlayset("<id>")`, result discarded): a long frame there involves no binding
  and no UI. Run a cheap eval first as a control, since attaching costs a frame of its own.
- Isolate the UI by replaying a captured value with `engine.trigger('<group>.<name>.update', value)`.
- Time a decode off-engine with a throwaway `HallOfFame.Tests` test on a saved response, writing to
  a file under `/tmp` (xUnit output does not reach the console); off-engine Mono runs faster than
  the game, so compare ratios rather than times. Save the response with `curl`, the authorization
  header written to a file by the unity `eval` and deleted after reading, never printed.

## Prevention

Pick a fresh screenshot for each cold run, close the details window before triggering a load by
hand, and read frames against the main menu's own frame time, which is long on this machine.
