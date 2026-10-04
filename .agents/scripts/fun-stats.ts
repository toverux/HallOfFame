// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable no-magic-numbers -- thresholds and list lengths read best where the stat is.

// Prints fun statistics over the local dev database, one `section.key: <json>` line per stat, for
// the `hof-fun-stats` skill.
//
// Run it from the repo root: `bun .agents/scripts/fun-stats.ts`. `--cap <date>` ignores the
// screenshots, creators, likes, and views created after that date, to compare with an earlier run.
// A date without a time is its midnight. Counters such as likes and views, and the mod records,
// stay the current ones.
//
// It only reads: mongosh runs one script of `aggregate` calls and hands the rows over as JSON, and
// every stat is computed here. The server stores a playset and photo mode settings even when their
// creator opted out of sharing them, so the query blanks those before they leave the database.

const databaseUrl = 'mongodb://localhost/halloffame';

// Playsets and photo mode settings are recorded from this date on.
const recordingStart = '2025-03-30T00:00:00.000Z';

const timeOfDay = 'Time of Day';
const focalLength = 'PhotoModeRenderSystem.focalLength';
const aperture = 'PhotoModeRenderSystem.aperture';

const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const query = `
  const cap = new Date(process.env.FUN_STATS_CAP);
  const text = field => ({ $toString: field });
  const iso = field => ({ $dateToString: { date: field } });
  const before = field => ({ $match: { [field]: { $lte: cap } } });
  const ranking = [
    { $group: { _id: '$creatorId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    { $project: { _id: 0, creatorId: text('$_id'), count: 1 } }
  ];

  print(EJSON.stringify({
    creators: db.creators.aggregate([
      before('createdAt'),
      { $project: { _id: 0, id: text('$_id'), name: '$creatorName' } }
    ]).toArray(),
    screenshots: db.screenshots.aggregate([
      before('createdAt'),
      { $project: {
        _id: 0,
        creatorId: text('$creatorId'),
        createdAt: iso('$createdAt'),
        cityName: 1,
        cityNameTranslated: 1,
        milestone: '$cityMilestone',
        population: '$cityPopulation',
        mapName: 1,
        likes: '$favoritesCount',
        likeRatio: '$favoritingPercentage',
        views: '$viewsCount',
        uniqueViews: '$uniqueViewsCount',
        hasDescription: { $gt: [{ $strLenCP: { $ifNull: ['$description', ''] } }, 0] },
        sharesPlayset: '$shareParadoxModIds',
        sharesSettings: '$shareRenderSettings',
        mods: { $cond: ['$shareParadoxModIds', { $ifNull: ['$paradoxModIds', []] }, []] },
        settings: {
          $cond: ['$shareRenderSettings', { $ifNull: ['$renderSettings', {}] }, { $literal: {} }]
        },
        gpu: '$metadata.gpuName'
      } }
    ]).toArray(),
    mods: db.mods.aggregate([
      { $match: { isRetired: false } },
      { $project: { _id: 0, id: '$paradoxModId', name: 1, authorName: 1, tags: 1,
        subscribers: '$subscribersCount' } }
    ]).toArray(),
    likers: db.favorites.aggregate([before('favoritedAt'), ...ranking]).toArray(),
    viewers: db.views.aggregate([before('viewedAt'), ...ranking]).toArray()
  }));
`;

interface Creator {
  readonly id: string;
  readonly name: string;
}

interface Screenshot {
  readonly creatorId: string;
  readonly createdAt: string;
  readonly cityName: string;
  readonly cityNameTranslated?: string | null;
  readonly milestone: number;
  readonly population: number;
  readonly mapName?: string | null;
  readonly likes: number;
  readonly likeRatio: number;
  readonly views: number;
  readonly uniqueViews: number;
  readonly hasDescription: boolean;
  readonly sharesPlayset: boolean;
  readonly sharesSettings: boolean;
  readonly mods: readonly number[];
  // Photo mode setting code to value, holding only the settings the creator switched on.
  readonly settings: Readonly<Record<string, number>>;
  readonly gpu?: string | null;
}

interface Mod {
  readonly id: number;
  readonly name: string;
  readonly authorName: string;
  readonly tags: readonly string[];
  readonly subscribers: number;
}

interface Ranked {
  readonly creatorId: string;
  readonly count: number;
}

interface Rows {
  readonly creators: readonly Creator[];
  readonly screenshots: readonly Screenshot[];
  readonly mods: readonly Mod[];
  readonly likers: readonly Ranked[];
  readonly viewers: readonly Ranked[];
}

interface Shot extends Screenshot {
  // Distinct settings changed: a multi-axis value such as `sensorSize/x` and `/y` counts once.
  readonly changed: readonly string[];
}

interface Dataset {
  readonly rows: Rows;
  readonly shots: readonly Shot[];
  // Uploaded since the recording start.
  readonly recorded: readonly Shot[];
  // Recorded and sharing their photo mode settings: the population of every settings stat.
  readonly withSettings: readonly Shot[];
  // Recorded and sharing their playset: the population of every playset stat.
  readonly withPlayset: readonly Shot[];
  readonly creatorNames: ReadonlyMap<string, string>;
  readonly mods: ReadonlyMap<number, Mod>;
}

// How much the screenshots sharing their playset use a mod.
interface ModUsage {
  readonly name: string;
  readonly author: string | undefined;
  readonly percent: number;
  readonly playsets: number;
  readonly creators: number;
  readonly subscribers: number | undefined;
  readonly isCode: boolean;
}

type Stats = Record<string, unknown>;

await run();

async function run(): Promise<void> {
  const data = await load(argument('--cap') ?? '2100-01-01');

  const sections: Record<string, Stats> = {
    overview: overviewStats(data),
    creators: creatorStats(data),
    cities: cityStats(data),
    photoMode: photoModeStats(data),
    photoModeExtremes: photoModeExtremeStats(data),
    playsets: playsetStats(data),
    sharing: sharingStats(data)
  };

  for (const [section, stats] of Object.entries(sections)) {
    for (const [key, value] of Object.entries(stats)) {
      console.log(`${section}.${key}: ${JSON.stringify(value)}`);
    }
  }
}

async function load(cap: string): Promise<Dataset> {
  const mongosh = Bun.spawn(['mongosh', databaseUrl, '--quiet', '--eval', query], {
    env: { ...Bun.env, FUN_STATS_CAP: cap },
    stderr: 'inherit'
  });

  const output = await new Response(mongosh.stdout).text();

  if ((await mongosh.exited) != 0) {
    throw new Error(`mongosh failed, is the dev database running? Output: ${output.slice(0, 500)}`);
  }

  const rows = JSON.parse(output) as Rows;

  const shots = rows.screenshots.map(screenshot => toShot(screenshot));

  const recorded = shots.filter(shot => shot.createdAt >= recordingStart);

  return {
    rows,
    shots,
    recorded,
    withSettings: recorded.filter(shot => shot.sharesSettings),
    withPlayset: recorded.filter(shot => shot.sharesPlayset),
    creatorNames: new Map(rows.creators.map(creator => [creator.id, creator.name])),
    mods: new Map(rows.mods.map(mod => [mod.id, mod]))
  };
}

function toShot(screenshot: Screenshot): Shot {
  const changed = new Set(Object.keys(screenshot.settings).map(key => key.split('/')[0] ?? key));

  return { ...screenshot, changed: [...changed] };
}

function overviewStats(data: Dataset): Stats {
  const dates = data.shots.map(shot => shot.createdAt).toSorted();

  return {
    screenshots: data.shots.length,
    first: dates.at(0),
    last: dates.at(-1),
    recorded: data.recorded.length,
    sharingSettings: data.withSettings.length,
    sharingPlayset: data.withPlayset.length
  };
}

function creatorStats(data: Dataset): Stats {
  const uploads = [...Map.groupBy(data.shots, shot => shot.creatorId)].map(([id, shots]) => ({
    name: nameOf(data, id),
    shots: shots.length,
    likes: sum(shots.map(shot => shot.likes))
  }));

  const ranked = (ranking: readonly Ranked[]): Array<[string, number]> =>
    ranking.map(entry => [nameOf(data, entry.creatorId), entry.count]);

  return {
    accounts: data.rows.creators.length,
    uploaders: uploads.length,
    oneUpload: uploads.filter(creator => creator.shots == 1).length,
    over100: uploads.filter(creator => creator.shots > 100).length,
    mostProlific: uploads
      .toSorted((a, b) => b.shots - a.shots)
      .slice(0, 5)
      .map(creator => [creator.name, creator.shots]),
    mostLoved: uploads
      .toSorted((a, b) => b.likes - a.likes)
      .slice(0, 5)
      .map(creator => [
        creator.name,
        `${creator.likes} likes over ${creator.shots}`,
        round(creator.likes / creator.shots)
      ]),
    topLikers: ranked(data.rows.likers),
    topViewers: ranked(data.rows.viewers),
    mostLiked: data.shots
      .toSorted((a, b) => b.likes - a.likes)
      .slice(0, 6)
      .map(shot => [label(data, shot), shot.likes, shot.createdAt.slice(0, 10)]),
    mostViewed: data.shots
      .toSorted((a, b) => b.views - a.views)
      .slice(0, 5)
      .map(shot => [label(data, shot), shot.views]),
    // Days are UTC ones.
    uploadsByDay: top(
      countBy(data.shots, shot => days[new Date(shot.createdAt).getUTCDay()]),
      7
    )
  };
}

function cityStats(data: Dataset): Stats {
  const final = data.shots.filter(shot => shot.milestone == 20);
  const mapped = data.shots.filter(shot => shot.mapName);

  const sharedNames = [...Map.groupBy(data.shots, shot => shot.cityName)]
    .map(([name, shots]) => ({
      name,
      translated: shots[0]?.cityNameTranslated ?? undefined,
      creators: new Set(shots.map(shot => shot.creatorId)).size
    }))
    .toSorted((a, b) => b.creators - a.creators);

  return {
    biggest: data.shots
      .toSorted((a, b) => b.population - a.population)
      .slice(0, 7)
      .map(shot => [label(data, shot), shot.population]),
    finalMilestonePercent: percent(final.length, data.shots.length),
    finalMilestoneZeroPopulation: final.filter(shot => shot.population == 0).length,
    medianPopulation: median(data.shots.map(shot => shot.population)),
    overMillion: data.shots.filter(shot => shot.population > 1e6).length,
    topMaps: top(
      countBy(mapped, shot => shot.mapName),
      5
    ),
    firstMapName: mapped.map(shot => shot.createdAt).toSorted()[0],
    distinctMaps: new Set(mapped.map(shot => shot.mapName)).size,
    mostSharedCityNames: sharedNames.slice(0, 5)
  };
}

function photoModeStats(data: Dataset): Stats {
  const shots = data.withSettings;
  const month = (shot: Shot): string => shot.createdAt.slice(0, 7);
  const settingCounts = countBy(
    shots.flatMap(shot => shot.changed),
    name => name
  );

  const times = shots.map(shot => shot.settings[timeOfDay]).filter(time => time != undefined);
  const hours = countBy(times, time => Math.floor(clockHour(time)));

  const sensors = countBy(shots, shot => {
    const width = shot.settings['PhotoModeRenderSystem.sensorSize/x'];
    const height = shot.settings['PhotoModeRenderSystem.sensorSize/y'];

    return width == undefined ? undefined : `${round(width, 2)}x${round(height ?? 0, 2)}`;
  });

  return {
    touchedPercent: percent(shots.filter(shot => shot.changed.length).length, shots.length),
    untouchedPercentByMonth: [...Map.groupBy(shots, month)]
      .toSorted(([a], [b]) => a.localeCompare(b))
      .map(([name, uploads]) => {
        const untouched = uploads.filter(shot => !shot.changed.length).length;

        return `${name}: ${percent(untouched, uploads.length)}% of ${uploads.length}`;
      }),
    mostChanged: top(settingCounts, 8),
    rarest: [...settingCounts].toSorted((a, b) => a[1] - b[1]).slice(0, 6),
    onlyTimeOfDay: shots.filter(shot => shot.changed.length == 1 && shot.changed[0] == timeOfDay)
      .length,
    exactlyNoon: times.filter(time => time == 12).length,
    shotsByHour: Array.from({ length: 24 }, (_, hour) => hours.get(hour) ?? 0),
    outsideTheClock: times.filter(time => time < 0 || time >= 24).length,
    focalLengths: top(
      countBy(shots, shot => rounded(shot.settings[focalLength], 0)),
      4
    ),
    sensors: top(sensors, 4),
    apertures: top(
      countBy(shots, shot => rounded(shot.settings[aperture], 1)),
      4
    )
  };
}

function photoModeExtremeStats(data: Dataset): Stats {
  // Creators are ranked over their uploads sharing settings, ten at least so one-offs do not win.
  const tweakers = [...Map.groupBy(data.withSettings, shot => shot.creatorId)]
    .filter(([, shots]) => shots.length >= 10)
    .map(([id, shots]) => ({
      name: nameOf(data, id),
      average: round(average(shots.map(shot => shot.changed.length))),
      uploads: shots.length
    }));

  return {
    timeTravellers: extremes(data, timeOfDay, 4),
    shortestFocalLengths: extremes(data, focalLength, 3, 'lowest'),
    longestFocalLengths: extremes(data, focalLength, 3),
    widestAperture: extremes(data, aperture, 1, 'lowest'),
    highestIso: extremes(data, 'PhotoModeRenderSystem.iso', 3),
    aurora: extremes(data, 'PhysicallyBasedSky.auroraBorealisEmissionMultiplier', 6),
    mostSettings: data.withSettings
      .toSorted((a, b) => b.changed.length - a.changed.length)
      .slice(0, 7)
      .map(shot => [label(data, shot), shot.changed.length]),
    tweakers: tweakers.toSorted((a, b) => b.average - a.average).slice(0, 5)
  };
}

function playsetStats(data: Dataset): Stats {
  const shots = data.withPlayset;
  const sizes = shots.map(shot => shot.mods.length);
  const isCode = (mod: Mod | undefined): boolean => mod?.tags.includes('Code Mod') ?? false;
  const usage = new Map<number, { playsets: number; creators: Set<string> }>();
  const authors = new Map<string, number>();

  for (const shot of shots) {
    const assetAuthors = new Set<string>();

    for (const id of new Set(shot.mods)) {
      const entry = usage.get(id) ?? { playsets: 0, creators: new Set() };
      const mod = data.mods.get(id);

      entry.playsets++;
      entry.creators.add(shot.creatorId);
      usage.set(id, entry);

      if (mod && !isCode(mod)) {
        assetAuthors.add(mod.authorName);
      }
    }

    for (const author of assetAuthors) {
      authors.set(author, (authors.get(author) ?? 0) + 1);
    }
  }

  const describe = (id: number): ModUsage => ({
    name: data.mods.get(id)?.name ?? `<${id}>`,
    author: data.mods.get(id)?.authorName,
    percent: percent(usage.get(id)?.playsets ?? 0, shots.length),
    playsets: usage.get(id)?.playsets ?? 0,
    creators: usage.get(id)?.creators.size ?? 0,
    subscribers: data.mods.get(id)?.subscribers,
    isCode: isCode(data.mods.get(id))
  });

  const used = [...usage].toSorted((a, b) => b[1].playsets - a[1].playsets).map(([id]) => id);

  // Creators are ranked over their shared playsets, ten at least so one-offs do not win.
  const averages = [...Map.groupBy(shots, shot => shot.creatorId)]
    .filter(([, uploads]) => uploads.length >= 10)
    .map(([id, uploads]) => ({
      name: nameOf(data, id),
      average: Math.round(average(uploads.map(shot => shot.mods.length))),
      uploads: uploads.length
    }));

  return {
    oneModOrNone: sizes.filter(size => size <= 1).length,
    median: median(sizes),
    average: round(average(sizes)),
    over500: sizes.filter(size => size >= 500).length,
    biggest: shots
      .toSorted((a, b) => b.mods.length - a.mods.length)
      .slice(0, 6)
      .map(shot => [label(data, shot), shot.mods.length]),
    biggestAverage: averages.toSorted((a, b) => b.average - a.average).slice(0, 4),
    essentials: used.slice(0, 6).map(id => describe(id)),
    firstAssets: used
      .filter(id => data.mods.has(id) && !isCode(data.mods.get(id)))
      .slice(0, 2)
      .map(id => describe(id)),
    // Share of playsets holding at least one of the author's non-code mods.
    assetCreators: top(authors, 6).map(([author, count]) => [author, percent(count, shots.length)]),
    // The fewest subscribers on Paradox Mods among the mods many creators here use.
    hiddenGems: used
      .filter(id => data.mods.has(id) && (usage.get(id)?.creators.size ?? 0) >= 25)
      .map(id => describe(id))
      .toSorted((a, b) => (a.subscribers ?? 0) - (b.subscribers ?? 0))
      .slice(0, 8),
    // The reverse: many subscribers, yet in few playsets.
    popularYetRare: data.rows.mods
      .filter(mod => mod.subscribers >= 100_000)
      .map(mod => describe(mod.id))
      .toSorted((a, b) => a.playsets - b.playsets)
      .slice(0, 6)
  };
}

function sharingStats(data: Dataset): Stats {
  const { recorded, withSettings, withPlayset } = data;
  const sharing = (playset: boolean, settings: boolean): Shot[] =>
    recorded.filter(shot => shot.sharesPlayset == playset && shot.sharesSettings == settings);
  const mods = (from: number, to: number): Shot[] =>
    withPlayset.filter(shot => shot.mods.length >= from && shot.mods.length < to);

  const between = (from: number, to: number): Shot[] =>
    withSettings.filter(shot => {
      const time = shot.settings[timeOfDay];
      const hour = time == undefined ? undefined : clockHour(time);

      return hour != undefined && hour >= from && hour < to;
    });

  const neverSharing = [...Map.groupBy(recorded, shot => shot.creatorId).values()].filter(shots =>
    shots.every(shot => !shot.sharesPlayset && !shot.sharesSettings)
  );

  return {
    neitherPercent: percent(sharing(false, false).length, recorded.length),
    creators: new Set(recorded.map(shot => shot.creatorId)).size,
    creatorsNeverSharing: neverSharing.length,
    untouched: summary(withSettings.filter(shot => !shot.changed.length)),
    over20Settings: summary(withSettings.filter(shot => shot.changed.length >= 20)),
    modsUnder50: summary(mods(0, 50)),
    mods50To99: summary(mods(50, 100)),
    mods100To399: summary(mods(100, 400)),
    modsOver400: summary(mods(400, Infinity)),
    goldenHour5To8And17To20: summary([...between(5, 8), ...between(17, 20)]),
    night20To5: summary([...between(20, 24), ...between(0, 5)]),
    day8To17: summary(between(8, 17)),
    sharingBoth: summary(sharing(true, true)),
    sharingSettingsOnly: summary(sharing(false, true)),
    sharingPlaysetOnly: summary(sharing(true, false)),
    sharingNeither: summary(sharing(false, false)),
    withDescription: summary(recorded.filter(shot => shot.hasDescription)),
    withoutDescription: summary(recorded.filter(shot => !shot.hasDescription)),
    gpus: top(
      countBy(data.shots, shot => shot.gpu),
      5
    )
  };
}

// The screenshots holding the highest (or lowest) values of a setting, with their likes.
function extremes(
  data: Dataset,
  setting: string,
  count: number,
  order: 'highest' | 'lowest' = 'highest'
): unknown[] {
  const direction = order == 'highest' ? -1 : 1;

  return data.withSettings
    .filter(shot => shot.settings[setting] != undefined)
    .toSorted((a, b) => direction * ((a.settings[setting] ?? 0) - (b.settings[setting] ?? 0)))
    .slice(0, count)
    .map(shot => [label(data, shot), shot.settings[setting], `${shot.likes} likes`]);
}

function summary(shots: readonly Shot[]): Stats {
  return {
    screenshots: shots.length,
    averageLikes: round(average(shots.map(shot => shot.likes))),
    averageLikeRatio: round(average(shots.map(shot => shot.likeRatio))),
    averageUniqueViews: Math.round(average(shots.map(shot => shot.uniqueViews)))
  };
}

function label(data: Dataset, shot: Shot): string {
  const translated = shot.cityNameTranslated ? ` (${shot.cityNameTranslated})` : '';

  return `${shot.cityName}${translated} by ${nameOf(data, shot.creatorId)}`;
}

function nameOf(data: Dataset, creatorId: string): string {
  return data.creatorNames.get(creatorId) ?? `an unnamed creator`;
}

/**
 * The Time of Day slider runs past a day, so the hour is its value folded back onto the clock.
 */
function clockHour(time: number): number {
  return ((time % 24) + 24) % 24;
}

function countBy<T, TKey>(
  items: readonly T[],
  keyOf: (item: T) => TKey | null | undefined
): Map<TKey, number> {
  const counts = new Map<TKey, number>();

  for (const item of items) {
    const key = keyOf(item);

    if (key != undefined) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return counts;
}

function top<TKey>(counts: ReadonlyMap<TKey, number>, count: number): Array<[TKey, number]> {
  return [...counts].toSorted((a, b) => b[1] - a[1]).slice(0, count);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: readonly number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

function median(values: readonly number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;

  return sorted.length % 2 ? upper : ((sorted[middle - 1] ?? 0) + upper) / 2;
}

function percent(part: number, whole: number): number {
  return round((100 * part) / whole);
}

function round(value: number, digits = 1): number {
  return Math.round(value * 10 ** digits) / 10 ** digits;
}

function rounded(value: number | undefined, digits: number): number | undefined {
  return value == undefined ? undefined : round(value, digits);
}

function argument(name: string): string | undefined {
  const index = Bun.argv.indexOf(name);

  return index == -1 ? undefined : Bun.argv[index + 1];
}
