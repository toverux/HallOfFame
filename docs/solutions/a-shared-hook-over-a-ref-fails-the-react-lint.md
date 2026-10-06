---
date: 2026-10-06
area: UI/utils
symptoms:
  - "react-hooks(exhaustive-deps): React Hook useEffect has missing dependencies: 'scrollableRef', and 'scrollableRef.current.scrollTop'"
  - 'react(immutability): This value cannot be modified'
tags: [oxlint, react-hooks, refs, virtual-list]
---

# A shared hook over a ref fails the React lint

## Problem

Two components each wired a ref to a vanilla `Scrollable` through the same callback ref. Extracting
that wiring into one shared hook fails `mise check:agents:oxlint` whichever way the hook handles the
ref.

## What didn't work

- A hook that creates the ref and returns it in a tuple (`[scrollableRef, findScrollable]`): the
  lint only recognizes a ref that comes straight from `useRef`, so a consumer effect that reads the
  returned ref is flagged for a missing dependency.
- A hook that takes the consumer's ref and assigns `scrollable.current` inside its callback: flagged
  as mutating a hook argument.

## Root cause

oxlint's React rules track refs by their `useRef` call site. A ref handed across a hook boundary,
out or in, is an ordinary value to them.

## Fix

Share a plain function, and leave the ref and the callback in each component:

```tsx
const scrollableRef = useRef<HTMLElement | null>(null);

const findScrollable = useCallback((node: HTMLElement | null) => {
  scrollableRef.current = findScrollableContent(node);
}, []);
```

`findScrollableContent` lives in `HallOfFame/UI/src/utils/virtual-list.ts`.

## Prevention

Share ref logic as functions that take and return elements. Each consumer keeps the `useRef` call
itself.
