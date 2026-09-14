---
date: 2026-09-14
area: UI
symptoms:
  - 'Escape does not close a panel opened from the main-menu slideshow controls'
  - 'A vanilla dropdown in the slideshow controls stays open on Escape'
tags: [cs2-ui, cs2-input, input-action, focus, main-menu, escape]
---

# Back never reaches the slideshow controls

## Problem

Escape did nothing on a vanilla panel opened from the main-menu slideshow controls, and a vanilla
dropdown there stays open on it too.

## Root cause

In the main menu Escape arrives as the `Back` input action, and a plain input consumer is
`ActiveOnFocus` (`index.js:32942-32943`): it hears an action only while the focus sits on its
branch. The slideshow controls are mounted outside the focus path the main menu drives, so nothing
in them ever holds the focus, and every focus-bound consumer there stays deaf, the vanilla
`Panel`'s own close handling included.

## Fix

Listen whatever holds the focus. `InputActionConsumer` from `cs2/input` with `ignoreFocusState`
runs `AlwaysActive` (`index.js:33061`), attached to the input root rather than to a focus branch
(`index.js:32928`):

```tsx
const backActions = useMemo(() => ({ Back: onClose }), [onClose]);

<InputActionConsumer actions={backActions} ignoreFocusState={true}>
```

## Prevention

Anything the slideshow controls open binds its own dismissal this way. `screenshot-details-window.test.tsx`
covers it by sending `Back` through an `EventInputProvider` with nothing focused.
