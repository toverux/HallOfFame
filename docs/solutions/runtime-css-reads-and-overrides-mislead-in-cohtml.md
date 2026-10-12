---
date: 2026-08-23
area: UI
symptoms:
  - 'An injected `<style>` rule has no effect, and its stylesheet reports no error'
  - 'An A/B test toggling a CSS rule at runtime measures the same result both ways'
  - '`parseFloat(getComputedStyle(el).fontSize)` returns a number far too small to be pixels'
tags: [cohtml, css, selectors, getcomputedstyle, measurement]
updated: 2026-10-12
---

# Runtime CSS reads and overrides mislead in cohtml

## Problem

Two of the browser habits for inspecting or overriding styles at runtime fail here, and both fail
quietly: an injected rule that changes nothing, and a computed length that is not a length.

## What didn't work

An injected override that changed nothing:

```js
// A no-op: the stylesheet exists and the rule parses, yet nothing changes.
style.textContent = '[class*="hof-dropdown-popup_"] { max-height: none !important; }';
```

The cause was never pinned down; the `[attr*=]` form itself matches in cohtml stylesheets, injected
ones included (`[class*="hof-button--previous_"]` applies on Cohtml 2.2.1.3). Nothing throws and
nothing logs, so it reads as "this rule changes nothing" rather than "this rule never applied". An
A/B test built on one measures the same configuration twice and concludes the change is inert.

Reading the root font size to convert `rem` to pixels:

```js
getComputedStyle(document.documentElement).fontSize; // "0.0520833vw", not "1px"
```

`getComputedStyle` returns the **specified** value, not the resolved one, so `parseFloat` yields
`0.0520833`. Every computed length is suspect this way, not just this one.

## Fix

When an override changes nothing, try a rule on the literal class name, its hash read off the live
element; it applied where the substring one did not:

```js
const popupClass = [...popup.classList].find(c => c.startsWith('hof-dropdown-popup'));
style.textContent = `.${popupClass} { max-height: none !important; }`;
```

For a length, measure a real element's `getBoundingClientRect().height`, which keeps the fraction
`offsetHeight` rounds off and includes an ancestor's transform (`virtual-list.ts` divides a uniform
scale out), instead of computing one from `rem`. There is no reading the layout's own units back
without restating the game's `@media (min-height: 56.25vw)` scaling rule, which is not worth owning.

## Prevention

Prove a runtime style override actually applied before trusting a measurement taken through it:
change something visible, or assert the property on the element. An override that silently no-ops
turns an experiment into a comparison of a configuration against itself, which reads as a real
result.
