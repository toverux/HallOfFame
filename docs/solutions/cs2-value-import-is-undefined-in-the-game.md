---
date: 2026-08-22
area: UI
symptoms:
  - 'A value imported from a `cs2/*` module is `undefined` at runtime while tsc reports no error'
  - 'Reading a member of a `cs2/*` enum throws "Cannot read properties of undefined"'
  - 'Focus errors in UI.log: "Cannot register child … Children are not allowed in this focus node!"'
  - 'Focus errors in UI.log: "Attempted to unregister mismatching focus key …"'
tags: [cs2-ui, cs2-input, typings, focus, enums, urbandevkit]
---

# A `cs2/*` value import is undefined in the game

## Problem

The `cs2/*` typings declare values the game does not export, and tsc accepts every one of them.
The import then arrives as `undefined`, which is silent wherever the consumer has a fallback.

`import { FOCUS_DISABLED } from 'cs2/ui'` is the worked case. Vanilla `TextInput` resolves its focus
key as `focusKey ?? FOCUS_AUTO`, so an `undefined` `FOCUS_DISABLED` registers the field in the focus
tree instead of keeping it out. A parent that allows no children then logs a failed registration on
mount, and a mismatched unregistration on unmount because the refused registration left the parent's
`childFocusKey` null.

## What didn't work

Rebuilding and reloading. The emitted bundle already read `focusKey: Se.FOCUS_DISABLED`, so the fix
looked deployed while `Se.FOCUS_DISABLED` was `undefined`, and the error came back byte-identical.

## Root cause

`@csmodding/urbandevkit`'s `cs2-types/` declares more than the game exports, and a declaration alone
gives tsc no way to notice. Each `cs2/<name>` module reaches the page as `window["cs2/<name>"]`, and
reading a missing key off one of those namespace objects yields `undefined` rather than throwing, so
nothing fails loudly either.

Two families of declaration have no runtime counterpart:

- **Misattributed values.** `ui.d.ts` declares the whole focus surface (`FOCUS_DISABLED`,
  `FOCUS_AUTO`, `FocusSymbol`, `FocusKey`, `UniqueFocusKey`) on `cs2/ui`. The game exports none of it
  there: every focus symbol belongs to `cs2/input`.
- **Enums.** No `cs2/*` enum exists at runtime, `UISound` and `LocElementType` included. Only the
  type survives.

Types erase, so only the values bite.

## Fix

Import a misattributed value from the module that actually exports it:

```ts
// `cs2/ui` declares `FOCUS_DISABLED` too, but only `cs2/input` exports it at runtime.
import { FOCUS_DISABLED, FocusSymbol } from 'cs2/input';
```

For an enum, keep the import type-only and reach for its string values through `` `${Enum}` ``, the
idiom already used across the codebase:

```ts
// The parameter takes the enum's string values without the enum object existing.
export function playSound(sound: `${UISound}`, volume = 1): void;

// A literal checked against the enum, in place of comparing to a member.
element.__Type == ('Game.UI.Localization.LocalizedString' satisfies `${LocElementType}`);
```

## Prevention

Import a `cs2/*` **type** freely; confirm the module before importing a **value**. The readable UI
bundle settles it: each namespace is an object built by an `n.d(<var>, { … })` export map, and one
`Object.defineProperties(window, …)` call binds each var to its module name. Search the export maps
for the symbol, then read which var holds it. No hit anywhere means no runtime value at all.

Checking the built bundle only helps if you check the right thing: the symbol name is present
whichever module it was imported from, so look at the namespace prefix it is read off.
