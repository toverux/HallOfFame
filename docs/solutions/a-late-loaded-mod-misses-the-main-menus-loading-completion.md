---
date: 2026-10-29
area: Systems
symptoms:
  - 'Main-menu context_entered and tour_started missing from about 9% of sessions'
  - 'The slideshow skips its main-menu setup with nothing in the logs'
  - 'Defer Mods load'
tags: [mod-lifecycle, loading, paradox-mods, usage-analytics]
---

# A late-loaded mod misses the main menu's loading completion

## Problem

Some launches ran none of the mod's main-menu setup: no main-menu `context_entered` or
`tour_started`, and an empty photo mode catalog for the slideshow. No error was logged.

## What didn't work

Blaming the transport. The server logs held no failed `/usage/events` request, and the lost
launches sent no usage request at all before their later events: the events were never tracked.

## Root cause

When the Paradox login and the mod sync outlast the boot, the game logs `Defer Mods load` in
`SceneFlow.log`, waits for the world to be ready, then loads Paradox Mods' mods
(`RegisterDatabase`, `src/Game/Game.SceneFlow/GameManager.cs:1501-1526`, then
`ModManager.Initialize(reinitialize: true)` at `:1643`). That can land after the main menu loaded:
the systems the mod creates then never get that load's `OnGameLoadingComplete` (`:1136`). Launches
on a slow login lose it; a local Mods-folder install never does.

## Fix

Each system with main-menu setup replays the event at the end of `OnCreate`:

```csharp
if (GameManager.instance.IsMainMenuLoaded) {
  this.OnGameLoadingComplete(Purpose.Cleanup, GameMode.MainMenu);
}
```

`IsMainMenuLoaded` (`Utils/GameManagerExtensions.cs`) reads mode `MainMenu` and state
`WorldReady`. The game raises the event just before it sets that state (`:1136-1137`), so a system
created late sees one or the other, never both and never neither.

## Prevention

A system that acts on a loading completion replays it at creation as above. The replay covers the
main menu only: a late load landing after a city load still misses that load's completion, and a
read made during the replay sees only the mods loaded before this one.
