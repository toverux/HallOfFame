---
name: hof-fun-stats
description: Mine the local dev database for fun statistics, write them up, and turn them into Discord posts.
disable-model-invocation: true
---

# Fun stats

A curiosity-driven report for the mod's owner and its Discord: who uploads the most, the biggest playset, the oddest photo mode settings.
Four steps, all read-only on the database: run the known stats, hunt for new ones, write the report, cut it into Discord posts.

## 1. Run the known stats

```
bun .agents/scripts/fun-stats.ts
```

It prints one `section.key: <json>` line per stat.
The database is the local dev MongoDB, a copy of production the user refreshes by hand: `overview.last` is its newest upload, so it dates the copy.
Where mongosh cannot connect, start it with `mise dev:db:start` in `../HallOfFameServer`.

Where `.scratch/fun-stats.md` already exists, it is the previous run: read it before it is overwritten, and note every fact whose winner or ranking changed.
To tell a real change from a definition drift, `bun .agents/scripts/fun-stats.ts --cap <the previous run's last upload, the full timestamp its report gives>` reproduces the previous numbers, counters and mod records aside.

## 2. Discovery

Hunt for facts the script does not print yet, with ad-hoc mongosh queries, until five new facts are kept or thirty queries have run:

```
mongosh "mongodb://localhost/halloffame" --quiet --json=relaxed --eval 'db.screenshots.findOne()'
```

- Only ever query `localhost`, and only read: `find`, `aggregate`, `countDocuments`.
- Exact collection and field names are in `../HallOfFameServer/prisma/schema.prisma`.
- Project server-side and keep outputs small (`$project`, `$limit`): screenshot documents are large.

Seeds, where nothing better comes to mind: outliers and extreme values, what changed since the previous run, a setting or a field recorded only recently, habits by locale or by hour, the screenshots a showcased mod appears on, anything odd or funny.

A fact is kept when it would make a creator smile or surprise the owner.
Each kept fact gets its stat added to `.agents/scripts/fun-stats.ts`, so the next run prints it: discovery is done when every kept fact comes out of `fun-stats.ts`.

### What the data hides

- **Unshared data is stored.** `paradoxModIds` and `renderSettings` are filled even where `shareParadoxModIds` or `shareRenderSettings` is false. Every playset or settings stat counts sharing screenshots only; the script blanks the rest in its query.
- **Recording starts late.** Playsets and settings exist from 2025-03-30 on, map names from late December 2025: a stat over them takes the screenshots uploaded since as its population, and a per-creator average takes that creator's sharing uploads, ten at least so one-offs do not win.
- **Setting keys contain dots** (`PhotoModeRenderSystem.focalLength`): a dotted path in a query addresses nothing. Read the object in JS, or use `$getField`.
- **Multi-axis settings** are stored one key per axis (`sensorSize/x`, `sensorSize/y`) and count as one setting.
- **Time of Day runs past 24**, the slider is not a clock: fold it with a modulo before reading an hour.
- **Counters are live.** `favoritesCount` and `viewsCount` hold today's values whatever the upload date, and come back as `Long` from mongosh.
- **Mod records are synced copies.** A mod's name, tags and subscriber count are at least as old as its `lastSyncedAt`, the last sync attempt: read it before trusting a stat built on them.
- **The `Code Mod` tag is no asset filter.** Paradox Mods tags most decal and texture packs as code mods, so a stat over mods without the tag undercounts their creators: say so beside it.

## 3. Write the report

`.scratch/fun-stats.md`, replaced whole:

- A title, then one line giving the source (the local dev database, a copy of production), the date, the screenshot count, the upload date range and the last upload as the full `overview.last` timestamp, which the next run caps at.
- A second line giving the recording start and the populations of the playset and settings stats.
- The facts grouped under a few headings, each one or two lines carrying its number, with a small table where one helps.
- Creators by their in-game creator name. IPs, hardware IDs and creator IDs stay out.

## 4. Cut it into Discord posts

`.scratch/fun-stats-discord.md`: one post per four-backtick fenced block, each ready to copy.

- Every post fits Discord's 2,000 characters; count them with a script once written.
- Discord renders `##` headings and `- ` lists, and no tables: a table becomes an inline list of its top entries.
- First person, in the owner's voice: they post it themselves, and are the creator `toverux` wherever that name ranks.
- The first post opens with the screenshot count and date range, and says more posts follow.
- Run the prose through the `humanizer:humanizer` skill.

Close by reporting both file paths, the five facts you found most fun, and what changed since the previous run.
