---
date: 2026-08-19
area: Services/CreatorIdentity
symptoms:
  - 'Creator sync stops halfway with no error after writing a setting'
tags: [settings, re-entrancy, cancellation]
---

# Saving settings from inside the identity sync cancels that sync

## Problem

Writing a value to `Mod.Settings` and saving it from within `CreatorIdentity.RunSync` aborts the
sync that is doing the saving. No exception surfaces: the work simply stops.

## Root cause

Saving is re-entrant into the sync it runs inside:

`ApplyAndSave` → `Apply` → `onSettingsApplied` → `Mod.cs` → `CreatorIdentity.OnSettingsApplied` →
`Sync` → `syncCts.Cancel()`.

The new sync cancels the in-flight one, which is the caller.

## Fix

Assign without saving. The value rides along with whatever saves next, and the startup sync learns
it again every session regardless:

```csharp
store.PublicCreatorID = creator.Id;
```

## Prevention

`RunSync_DoesNotSaveSettingsWhenLearningPublicCreatorId` asserts `SaveCount == 0`, so restoring the
save turns the test red.
