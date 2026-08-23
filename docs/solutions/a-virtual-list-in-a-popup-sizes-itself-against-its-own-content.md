---
date: 2026-08-23
area: UI
symptoms:
  - 'A virtualized list builds hundreds of rows on open and drops them a frame later'
  - 'A row measures `offsetHeight` 0 immediately after React inserts it'
  - 'A virtual list renders a screen of rows regardless of how small its container looks'
tags: [cohtml, virtual-list, dropdown, anchored-popup, layout, measurement]
---

# A virtual list in a popup sizes itself against its own content

## Problem

Cohtml lays out on its own frame, not on demand. Anything reading geometry has to reckon with a
window where the DOM exists and its size does not, and a virtual list dropped into a popup spends
that window sizing itself against the wrong number.

Measured on a 600-item asset dropdown, rows in the DOM over the frames after opening:

```
f=0: 1    f=1: 40    f=2: 478    f=3: 478    f=4: 15
```

478 rows built and thrown away, each carrying a remote thumbnail.

## Root cause

`AnchoredPopup` computes the popup's `max-height` from the space below its anchor and applies it
inline, but only from the fourth frame. Until then the popup is as tall as its content, so the
scroll container reports the whole list's height as its viewport, and `useUniformSizeProvider`
returns a row per row of it.

The same deferral hits measurement directly: a freshly inserted row reads `offsetHeight` 0, and no
read taken while React is still committing can see otherwise. `useLayoutEffect` does not help,
because the frame the engine lays out on has not happened yet.

Vanilla's own virtual lists avoid all of this by living in containers that are already sized.

## Fix

Cap the popup in the mod's own stylesheet, which governs exactly the frames before the engine's
inline clamp lands and is superseded by it after:

```scss
max-height: 100vh;
```

478 rows becomes 40; the settled count is 15 either way, and nothing looks different.

For the row height, retry on animation frames until an element answers, holding an estimate
meanwhile:

```ts
function measure(): void {
  const row = scrollable.current?.querySelector(selector(dropdownTheme.dropdownItem));

  if (row instanceof HTMLElement && row.offsetHeight > 0) {
    setRowHeight(row.offsetHeight);
  } else {
    frame = requestAnimationFrame(measure);
  }
}
```

Gating the list's first render on that measurement also works, and is worse: it shows a blank menu
filling in with the scrollbar arriving late.

## Prevention

Treat a container's size as unknown for the first frames of anything the engine positions, and give
the engine a bound of your own to use until it has one. Where a number must be read from layout,
read it from a rendered element on a later frame rather than computing it.
