---
date: 2026-09-11
area: UI
symptoms:
  - 'No slideshow on the main menu and no HoF button in Photo Mode, with nothing in UI.log'
  - 'The mod works alone or in a small playset and fails in a large one'
  - 'TypeError: Intl.Collator is not a constructor'
tags: [cs2-ui, mod-loader, mod-conflict, intl, polyfill, ufuzzy]
---

# A mod UI vanishes when its module throws on load

## Problem

The whole HoF UI went missing in some playsets: no menu slideshow, no Photo Mode button. The C# half
kept running, so Simple Mod Checker still reported the mod as loaded, and no log said anything.

## What didn't work

Reading the logs. `HallOfFame.log` showed a healthy C# side, while `UI.log` and the UI console held
nothing from HoF: the game's loader discards the error before anything can print it.

## Root cause

The vanilla mod loader imports each mod's `.mjs` and swallows a rejection whole,
`import(e).then(…).catch(() => o())` in the game UI bundle. A mod whose module throws during
evaluation is dropped without a trace, and its CSS is never linked.

HoF's module threw because Cohtml ships no global `Intl`, and InfoLoomTwo installs the Intl.js
polyfill when `Intl` is absent. That polyfill has `NumberFormat` and `DateTimeFormat` but no
`Collator`. uFuzzy picks its default tie-break with
`typeof Intl == "undefined" ? cmp : new Intl.Collator(…)`, so under the polyfill it calls a missing
constructor, and `asset-mod-search.ts` built its uFuzzy instance at module scope.

Mod imports run concurrently, so HoF breaks only when InfoLoomTwo's module evaluates first.

## Fix

Hand uFuzzy its comparator, which keeps it off `Intl` entirely:

```ts
const fuzzy = new uFuzzy({
  // …
  compare: (a, b) => (a > b ? 1 : a < b ? -1 : 0)
});
```

Code point order is what uFuzzy's own fallback does, so search sorts as it always did in the game.

## Prevention

Construct libraries and read `Intl` inside functions rather than at module scope: a throw there costs
one feature, where the same throw at module load costs the whole UI. `asset-mod-search.test.ts` locks
this case in by deleting `Intl.Collator` and re-importing the module behind a query-string
specifier, which runs its module-scope code again.

To diagnose a silently missing mod UI in the live game, look for the mod's CSS `<link>` by id, which
the loader adds only after a successful import. Then `game_eval` an
`import('coui://ui-mods/<ModId>.mjs')` with `awaitPromise`: the rejection the loader swallowed comes
back with its stack.
