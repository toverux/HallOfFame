---
date: 2026-09-14
area: UI
symptoms:
  - 'Closing a vanilla panel opened from the main-menu controls makes the whole main menu vanish'
tags: [cs2-ui, panel, portal, transition, main-menu, vanilla]
---

# A portaled panel closes the main menu with it

## Problem

A vanilla `Panel` rendered through `Portal` from the main-menu slideshow controls took the main
menu with it: closing the panel removed the menu screen too.

## What didn't work

Cutting the panel off with a `TransitionContext.Provider` holding the vanilla `defaultContext`.
The menu survives, but the panel then registers with nothing and never plays its enter or exit
transition.

## Root cause

A portal moves the DOM, not the React tree, so the panel still reads the `TransitionContext` of the
transition group around the main menu. The panel's transition registers through that context
(`index.js:31676`), and the group hands each keyed child a context whose `onUnmount` unregisters
that child's key (`index.js:30452-30459`). Unmounting the panel unregisters the menu screen's key,
and the group drops the menu screen.

## Fix

Give the panel a transition group of its own. `TransitionGroupCoordinator`
(`game-ui/common/animations/transition-group-coordinator.tsx`) hands each keyed child a fresh
context, and plays the panel's enter and exit transitions, keeping a closing panel mounted until
its exit has played:

```tsx
<Portal>
  <TransitionGroupCoordinator>
    {isOpen && <DetailsModal key='details' screenshot={screenshot} onClose={onClose} />}
  </TransitionGroupCoordinator>
</Portal>
```

## Prevention

Any vanilla component carrying a transition, a `Panel` among them, rendered from inside a
transition group needs its own coordinator, portal or not. `screenshot-details-window.test.tsx`
locks this in: it wraps the window in a spy `TransitionContext` and asserts that closing it never
calls the outer `onUnmount`.
