---
date: 2026-10-27
area: Systems/DashboardUISystem
symptoms:
  - 'A confirmation awaited through ShowConfirmationDialogAndWait never answers'
  - 'Back or Delete stop doing anything after another dialog showed over the first'
tags: [cs2-ui, confirmation-dialog, app-bindings, re-entrancy]
---

# A second game dialog orphans the first

## Problem

A confirmation dialog the mod awaits never answers once another dialog opens over it, so the code
awaiting it, and any guard it holds, waits for good.

## Root cause

The game keeps one dialog callback, `AppBindings.m_ConfirmationDialogCallback` in the decompile.
Every `ShowConfirmationDialog` and `ShowMessageDialog` overwrites it, from the mod or from vanilla
(`ModManager`, `InputManager` and `GameManager` all show dialogs), so the earlier dialog's answer goes
to the later one's handler.

## Fix

`DashboardService.Confirm` opens one dialog at a time and declines a second request while one is
up, a double Back included. `CloseDetail` frees that guard, since a dialog another replaced never
answers, and each caller drops a late answer once `detailGeneration` has moved on.
`ErrorMessageDialog` reads the pending callback before it shows an error and writes it back from
the error's own callback: the game stacks its dialogs, so the one under the error answers next.

## Prevention

Await a game dialog only behind a guard that a later state change frees, and drop an answer that
arrives for a view already gone. Show a mod message that may open over an awaited confirmation
through `ErrorMessageDialog`, or restore the pending callback as it does; `ErrorMessageDialogTests`
covers the hand-back. `DashboardServiceTests` covers the double Back
(`ConfirmClose_AgainWhileItsDialogIsOpen_AsksOnce`) and the orphaned dialog
(`ConfirmCloseDetail_AfterTheDetailClosedOnAnUnansweredDialog_AsksAgain`).
