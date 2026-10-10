---
name: hof-playset-filters-rescan
description: Rescan the Paradox Mods tag data in the local dev database and revise the playset tab's kind and category toggles.
disable-model-invocation: true
---

# Playset filters rescan

The playset tab narrows a screenshot's mods with toggles the mod maps from Paradox Mods tags, in `assetCategoryMatches` and `playsetKindMatches` of `HallOfFame/UI/src/area-menu/menu-controls/screenshot-details.ts`.
Tags drift as Paradox and creators tag new mods, so the mapping is rescanned from time to time against the local dev database, a copy of production the user refreshes by hand.
Four steps: run the scan, read it against the standing decisions, revise the mapping, verify.

## 1. Run the scan

```
bun .agents/scripts/playset-filters-scan.ts
```

It runs the matchers the game ships over every published mod and prints one `section.key: <json>` line per measure: each toggle's count, every pair of toggles with mods in common (their count, their most frequent tags, their most subscribed samples), the mods no toggle holds, and every tag on twenty assets or more with how its carriers split across the categories.
Where mongosh cannot connect, start the database with `mise dev:db:start` in `../HallOfFameServer`.

## 2. Read the scan

Judge every pair, every uncovered tag family and every small toggle against the decisions below, and keep a list of the revisions worth making.
A revision is worth making when:

- **A tag leaks.** A pair's most frequent tags show one toggle's tag riding on another kind of thing, as `Prop` rides on buildings that ship props: the leaking toggle gets an exclusion.
- **A tag family grows.** A family of tags no toggle covers, or one folded into a wider toggle, holds enough assets that a player would look for it: it gets a toggle. Smallness alone is no bar.
- **A toggle empties.** A toggle holding next to nothing on every playset is retired.

Reading is done when every pair with a hundred mods or more, and every uncovered tag on fifty assets or more, has a verdict: standing decision, revision, or new decision to record.

### Standing decisions

Each decision below settled a verdict once; a rescan revisits it only on new evidence.

- **Kinds are Code mods, Assets and Maps.** Savegames have no toggle, a handful of them per playset being worth no room, and Maps leaves out the savegames also tagged `Map`. The `Code Mod` tag also sits on most decal and texture packs, which is Paradox's tagging, kept as is.
- **A match is a plain tag match unless a decision says otherwise.** A mod counts under every toggle it matches, so counts need not add up.
- **Props keeps only what is nothing else.** Paradox tags a building, a vehicle or a road asset `Prop` as well when it ships its own props, so Props excludes the carriers of `Building`, `Vehicle` and the roads match.
- **Roads takes the toolbar tags and bridges, without parking.** Intersections and many road packs carry only the game's `UIRoads*` toolbar tags and no `Net`, so those count, and `Bridge` with them. Parking lots are filed under the roads toolbar but are the buildings and props they are also tagged as, so a `UIRoadsParking` carrier is not a road.
- **Vegetation, Surfaces and Creatures stay while small.** Players look for them and they grow.
- **Asset packs stays additive.** A pack of buildings counts under both.
- **Region tags are no category.** `North American` and `European` name a region, not a kind of thing; the scan leaves them out.
- **Themes, zones and the building families are not split.** Themes and zone packs without a building are rare and sit under All assets. Signature buildings, service buildings, spawnable buildings, parks and stations are the second level Buildings would split into if it ever feels too coarse, not toggles of their own.

## 3. Revise the mapping

For each revision:

- Change the matcher in `screenshot-details.ts`, and its tests in the colocated test file: a new toggle gets its id in the `AssetCategory` or `PlaysetKind` union and its place in the table's order, which is the toggles' order.
  A revision to a decision a matcher's docblock states is written there too.
- A new toggle gets its label in the window's label map and in `HallOfFame/Locales/en-US.json`, under `PLAYSET_KIND` or `PLAYSET_CATEGORY`, and its translations per the localization guideline in `AGENTS.md`.
- Record the decision above, replacing the one it revises, so the next rescan does not re-litigate it.

## 4. Verify

`mise check:agents` and `mise test:ui` pass, and the scan runs again with the toggles' counts moved the way the revision meant.
Where the game runs, load a large playset with `LoadScreenshotById` (see `AGENTS.md`) and check the toggles' row wraps and reads.

Close by reporting the verdicts, the revisions made, and the decisions recorded.
