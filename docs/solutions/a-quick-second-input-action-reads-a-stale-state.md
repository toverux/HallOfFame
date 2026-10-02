---
date: 2026-10-02
area: UI
symptoms:
  - 'Two quick Switch Tab presses advance the tabs only once'
  - 'A component test resending an input action inside waitFor skips past the expected state'
tags: [cs2-ui, cs2-input, input-action, stale-closure, switch-tab, testing]
---

# A quick second input action reads a stale state

## Problem

Switch Tab computed the next tab from the `selectedTab` its render captured, so a second press
landing before the next frame started from the same tab and the press was lost.

## Root cause

The input root's `setDirty` rebuilds the stack of consumers' handlers on a `requestAnimationFrame`
(the root class just before `game-ui/common/input-events/input-controller.ts` in the UI bundle), so
until then an action runs the previous render's handler and whatever state it closed over.

## Fix

Read the state through a functional updater, so the handler needs no render value:

```tsx
setSelectedTab(currentTab => nextTabAfter(currentTab));
```

## Prevention

A test sending a non-idempotent action waits one frame for the stack to take the consumer in,
then sends each action once: resending it inside `waitFor` until it lands counts every resend
(see `nextFrame` in `screenshot-details-window.test.tsx`).
