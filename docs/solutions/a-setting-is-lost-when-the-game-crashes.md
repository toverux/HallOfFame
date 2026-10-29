---
date: 2026-10-29
area: Settings
symptoms:
  - 'The menu tour shows again after the game crashed, though the player closed it'
tags: [settings, persistence, crash, apply-and-save]
---

# A setting is lost when the game crashes

## Problem

A setting the mod changes in memory, such as the menu tour's seen flag, comes back at its old
value after a crash, so the tour showed again on the next launch.

## What didn't work

The base `Setting.ApplyAndSave`. It applies first, which raises `onSettingsApplied` and restarts
the creator sync, and it picks the file to write from the short class name: another mod's
`Settings` class shares it, and the save writes that mod's file instead.

## Root cause

The game writes mod settings only on a clean quit (`SaveAllSettings`,
`src/Game/Game.SceneFlow/GameManager.cs:798`), and modded games crash often.

## Fix

A change that must survive a crash saves at once through
`AssetDatabase.global.SaveAllSettings()`, the quit's own path, which writes every mod's settings
without applying them (`Settings.SaveAll`, reached through `IMenuTourStore.Save`).
`Settings.ApplyAndSave` is overridden to apply, then save the same way, since the options page
calls it on every change (`AutomaticSettings.cs`).
The game queues these saves with one running and one waiting, dropping the rest, so a burst of
changes costs at most two; a save lands seconds after the request, behind a game load in
progress.

## Prevention

`MenuTourTests.Close_SavesTheSeenTour_OnceAndAtOnce` asserts the tour saves the flag the moment
it closes.
