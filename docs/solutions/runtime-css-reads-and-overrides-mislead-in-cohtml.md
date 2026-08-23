---
date: 2026-08-23
area: UI
symptoms:
  - 'An injected `<style>` rule has no effect, and its stylesheet reports no error'
  - 'An A/B test toggling a CSS rule at runtime measures the same result both ways'
  - '`parseFloat(getComputedStyle(el).fontSize)` returns a number far too small to be pixels'
tags: [cohtml, css, selectors, getcomputedstyle, measurement]
---

# Runtime CSS reads and overrides mislead in cohtml

## Problem

Two of the browser habits for inspecting or overriding styles at runtime fail here, and both fail
quietly: an injected rule that matches nothing, and a computed length that is not a length.

## What didn't work

Overriding a class with an attribute-substring selector, twice, in two forms:

```js
// Both no-ops. The stylesheet exists, the rule parses, nothing matches.
style.textContent = '[class*="hof-dropdown-popup_"] { max-height: none !important; }';
```

`[attr*=]` is rejected by cohtml's selector engine in **stylesheets** as well as in
`querySelector`/`closest`. Nothing throws for the stylesheet case, so the override reads as "this
rule changes nothing" rather than "this rule never ran". An A/B test built on one measures the same
configuration twice and concludes the change is inert.

Reading the root font size to convert `rem` to pixels:

```js
getComputedStyle(document.documentElement).fontSize; // "0.0520833vw", not "1px"
```

`getComputedStyle` returns the **specified** value, not the resolved one, so `parseFloat` yields
`0.0520833`. Every computed length is suspect this way, not just this one.

## Fix

Target a literal class name, reading the hash off the live element rather than pattern-matching it:

```js
const popupClass = [...popup.classList].find(c => c.startsWith('hof-dropdown-popup'));
style.textContent = `.${popupClass} { max-height: none !important; }`;
```

For a length, measure a real element's `offsetHeight` instead of computing one from `rem`. There is
no reading the layout's own units back without restating the game's `@media (min-height: 56.25vw)`
scaling rule, which is not worth owning.

## Prevention

Prove a runtime style override actually applied before trusting a measurement taken through it:
change something visible, or assert the property on the element. An override that silently no-ops
turns an experiment into a comparison of a configuration against itself, which reads as a real
result.
