---
date: 2026-08-19
area: UI/components
symptoms:
  - 'Tooltip never opens when its child is a mod component rendering a vanilla widget'
  - 'Tooltip opens once, then stops responding after the widget re-renders'
tags: [cohtml, dom-node, tooltip, dropdown]
---

# A tooltip over a vanilla wrapper anchors to nothing

## Problem

A `Tooltip` whose child is a mod component that renders a vanilla `Dropdown` never opens: the
tooltip gets no anchor element, so its hover listeners are attached to nothing.

## What didn't work

Wrapping the mod component directly, with no element in between. The tooltip and the dropdown then
compete for one element's handle, and opening the dropdown re-resolves it, which strips the
tooltip's listeners off the element for good.

## Root cause

The game passes DOM handles down a context chain rather than through refs. `DOMNodeProvider`, which
every vanilla widget rendering host children installs, **severs** that chain: it answers the handle
request itself and passes nothing further down. A `DOMNodeModifier` above it therefore resolves to
`null`.

`Tooltip` claims its anchor exactly as the vanilla one does, through a single `DOMNodeModifier`
(`HallOfFame/UI/src/components/tooltip.tsx:98`), so it is on the losing side of that cut.

## Fix

Give the tooltip a host element of its own — a plain `<span>` around the mod component:

```tsx
<Tooltip tooltip={…}>
  <span>
    <MenuControlsViewerLink …>{city.name}</MenuControlsViewerLink>
  </span>
</Tooltip>
```

Every call site owes the link that wrapper; `HallOfFame/UI/src/area-menu/menu-controls/city-name.tsx`
does it twice.

## Prevention

The wrappers look redundant and read as deletable. `viewer-link.tsx`'s docblock states the
obligation, so a maintainer reaching for the component meets it before removing one.
