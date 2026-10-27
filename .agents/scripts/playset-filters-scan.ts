// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable no-magic-numbers -- sample sizes and cut-offs read best where the stat is.

// Measures the playset tab's kind and category toggles against the mods in the local dev
// database, for the `hof-playset-filters-rescan` skill: how many mods each toggle holds, which
// toggles overlap and on what, and which tags no toggle covers.
//
// Run it from the repo root: `bun .agents/scripts/playset-filters-scan.ts`.
// It reads the matchers the game ships, so a change to them shows in the next run, and it only
// reads the database: mongosh hands the published mods' tags over as JSON.

import {
  assetCategoryMatches,
  playsetKindMatches,
  type TagsMatch
} from '../../HallOfFame/UI/src/components/screenshot-details/screenshot-details';

const databaseUrl = 'mongodb://localhost/halloffame';

interface ScannedMod {
  readonly name: string;
  readonly tags: readonly string[];
  readonly subscribersCount: number;
}

// Region tags sit on most assets and name no kind of thing, so they drop out of every tag list.
const regionTags: ReadonlySet<string> = new Set(['North American', 'European']);

const query = `
  print(EJSON.stringify(db.mods.aggregate([
    { $match: { state: 'published' } },
    { $project: { _id: 0, name: 1, tags: { $ifNull: ['$tags', []] }, subscribersCount: 1 } }
  ]).toArray()));
`;

const mods = await readMods();

const assets = mods.filter(mod => playsetKindMatches.assets(mod.tags));

print('overview', { publishedMods: mods.length, assets: assets.length });

const kinds = toggles(playsetKindMatches, mods);
const categories = toggles(assetCategoryMatches, assets);

print('kinds.counts', counts(kinds, mods));
print('kinds.overlaps', overlaps(kinds));
print('kinds.uncovered', uncovered(covered(kinds), mods));

const coveredAssets = covered(categories);

print('categories.counts', counts(categories, assets));
print('categories.overlaps', overlaps(categories));
print('categories.uncovered', uncovered(coveredAssets, assets));

// A tag worth a toggle of its own, or a leak to stop, shows here: its carriers, how many of them
// no category covers, and the categories they fall under.
print('categories.tags', tagSpread(categories, coveredAssets, assets));

interface Toggle {
  readonly id: string;
  readonly mods: readonly ScannedMod[];
}

function toggles(
  matches: Readonly<Record<string, TagsMatch>>,
  population: readonly ScannedMod[]
): readonly Toggle[] {
  return Object.entries(matches).map(([id, match]) => ({
    id,
    mods: population.filter(mod => match(mod.tags))
  }));
}

function counts(
  list: readonly Toggle[],
  population: readonly ScannedMod[]
): Record<string, number> {
  const record: Record<string, number> = { all: population.length };

  for (const toggle of list) {
    record[toggle.id] = toggle.mods.length;
  }

  return record;
}

/**
 * Every pair of toggles holding mods in common: how many, the tags most often on them, and the
 * most subscribed few, so a secondary tag leaking a kind of thing into another toggle shows.
 */
function overlaps(list: readonly Toggle[]): readonly object[] {
  const pairs: object[] = [];

  for (const [index, first] of list.entries()) {
    const firstMods = new Set(first.mods);

    for (const second of list.slice(index + 1)) {
      const shared = second.mods.filter(mod => firstMods.has(mod));

      if (shared.length > 0) {
        pairs.push({
          toggles: [first.id, second.id],
          count: shared.length,
          topTags: topTags(shared, 6),
          samples: samples(shared, 5)
        });
      }
    }
  }

  return pairs;
}

// The mods some toggle but All holds.
function covered(list: readonly Toggle[]): ReadonlySet<ScannedMod> {
  return new Set(list.flatMap(toggle => toggle.mods));
}

/**
 * The mods no toggle but All holds: how many, and the tags most often on them.
 */
function uncovered(
  coveredMods: ReadonlySet<ScannedMod>,
  population: readonly ScannedMod[]
): object {
  const rest = population.filter(mod => !coveredMods.has(mod));

  return { count: rest.length, topTags: topTags(rest, 25), samples: samples(rest, 8) };
}

/**
 * Every tag on twenty assets or more, with how many of its carriers no category covers, and how
 * its carriers split across the categories.
 */
function tagSpread(
  list: readonly Toggle[],
  coveredMods: ReadonlySet<ScannedMod>,
  population: readonly ScannedMod[]
): readonly object[] {
  const byTag = new Map<string, ScannedMod[]>();

  for (const mod of population) {
    for (const tag of mod.tags) {
      if (!regionTags.has(tag)) {
        const carriers = byTag.get(tag);

        if (carriers) {
          carriers.push(mod);
        } else {
          byTag.set(tag, [mod]);
        }
      }
    }
  }

  return [...byTag.entries()]
    .filter(([, carriers]) => carriers.length >= 20)
    .sort(([, a], [, b]) => b.length - a.length)
    .map(([tag, carriers]) => {
      const carrierSet = new Set(carriers);

      return {
        tag,
        carriers: carriers.length,
        uncovered: carriers.filter(mod => !coveredMods.has(mod)).length,
        under: Object.fromEntries(
          list
            .map((toggle): [string, number] => [
              toggle.id,
              toggle.mods.filter(mod => carrierSet.has(mod)).length
            ])
            .filter(([, count]) => count != 0)
        )
      };
    });
}

function topTags(list: readonly ScannedMod[], limit: number): Record<string, number> {
  const tally = new Map<string, number>();

  for (const mod of list) {
    for (const tag of mod.tags) {
      // Paradox leaves an empty tag on a few mods.
      if (!regionTags.has(tag) && tag != 'Prefab' && tag != '') {
        tally.set(tag, (tally.get(tag) ?? 0) + 1);
      }
    }
  }

  return Object.fromEntries([...tally.entries()].sort(([, a], [, b]) => b - a).slice(0, limit));
}

function samples(list: readonly ScannedMod[], limit: number): readonly string[] {
  return list
    .toSorted((a, b) => b.subscribersCount - a.subscribersCount)
    .slice(0, limit)
    .map(mod => `${mod.name} [${mod.tags.filter(tag => !regionTags.has(tag)).join(', ')}]`);
}

function print(key: string, value: unknown): void {
  console.log(`${key}: ${JSON.stringify(value)}`);
}

async function readMods(): Promise<readonly ScannedMod[]> {
  const mongosh = Bun.spawn(['mongosh', databaseUrl, '--quiet', '--eval', query], {
    stdout: 'pipe',
    stderr: 'inherit'
  });

  const output = await new Response(mongosh.stdout).text();

  if ((await mongosh.exited) != 0) {
    throw new Error(`mongosh exited with code ${mongosh.exitCode}.`);
  }

  return JSON.parse(output) as ScannedMod[];
}
