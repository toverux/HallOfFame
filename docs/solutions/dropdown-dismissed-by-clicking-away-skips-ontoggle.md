---
date: 2026-08-23
area: UI
symptoms:
  - 'State reset in the `onToggle` of a vanilla `Dropdown` survives a dismissal by clicking outside it'
  - 'A dropdown resets correctly on Escape or on picking an item, but not on click-away'
tags: [cs2-ui, dropdown, vanilla, focus]
updated: 2026-08-23
---

# A dropdown dismissed by clicking away skips `onToggle`

## Problem

Vanilla `Dropdown` calls `onToggle` on every way of closing but one: the mousedown outside the menu
that dismisses it. That is the most common dismissal, so per-close cleanup written into `onToggle`
looks correct on Escape and on picking an item, then leaks state on the path players actually take.

## Root cause

The dropdown keeps its own `visible` state and pairs the setter with `onToggle` in the handlers it
publishes on `DropdownContext` — `hide` is `(c(!1), o && o(!1))` at `source.js:41866`, `show` and
`toggle` likewise. The outside-mousedown listener it installs while open bypasses all three and calls
the raw setter, `c(!1)` at `source.js:41881`.

Nothing observes that path: it changes `visible` without telling the consumer.

## Fix

Reset on open rather than on close. `visible` from `DropdownContext` is truthful whichever path
closed the menu, so a layout effect on it covers every dismissal:

```tsx
const { visible, hide } = useContext(DropdownContext);

useLayoutEffect(() => {
  if (visible) {
    onFilterChange('');
  }
}, [visible, onFilterChange]);
```

A layout effect rather than a plain one, so reopening never paints the stale value for a frame.

## Prevention

Read `onToggle(false)` as "the consumer closed it", not as "it closed". Per-open state resets on
open; anything that genuinely must run at close needs a cleanup keyed on `visible`.

The reset has to cover every piece of state derived from the one being cleared, not just the field
itself. A debounced copy of a filter outlived the reset here: the field was emptied on open while
the debounced value still held the last search, so the first character typed after reopening
searched the previous session's needle until the timer caught up. Derived state that is scheduled
rather than assigned is the case to watch, since the next keystroke cancels the pending reset.
