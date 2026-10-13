import {
  type CreatorStats,
  type DashboardScreenshot,
  type ScreenshotRank,
  screenshotRanks
} from '../../common';

/**
 * The orders the grid offers, in the order the dropdown offers them,
 * newest first being the one it opens on.
 * Each measure's two directions sit side by side, so the opposite of an order is the next line.
 */
export const dashboardSorts = [
  'newest',
  'oldest',
  'mostLiked',
  'leastLiked',
  'mostViewed',
  'bestRank'
] as const;

export type DashboardSort = (typeof dashboardSorts)[number];

/**
 * What the grid shows, in the order the tabs offer it:
 * the whole collection, then the screenshots without a medal,
 * then those holding each medal, from the bottom of the ladder up.
 */
export const dashboardFilters = ['all', 'unranked', ...screenshotRanks] as const;

export type DashboardFilter = (typeof dashboardFilters)[number];

/**
 * How many of the collection's screenshots each filter shows.
 */
export type MedalTally = Readonly<Record<DashboardFilter, number>>;

/**
 * What a card shows in its medal slot.
 * The server ranks no screenshot below either of the creator stats' two minimums,
 * and tells the two cases apart by nothing but the counters.
 */
export type MedalState =
  | { readonly kind: 'ranked'; readonly rank: ScreenshotRank }
  // Too few viewers yet for its like rate to mean anything.
  | {
      readonly kind: 'settling';
      readonly uniqueViewsCount: number;
      readonly minUniqueViewsCount: number;
    }
  // Seen by enough viewers, but liked by too few of them.
  | { readonly kind: 'noMedal'; readonly minLikesCount: number };

/**
 * The collection in the order `sort` asks for, as a new array.
 * Ties fall back to newest first, so an order never shuffles between two openings.
 */
export function sortScreenshots(
  screenshots: readonly DashboardScreenshot[],
  sort: DashboardSort
): readonly DashboardScreenshot[] {
  const compare = comparators[sort];

  return [...screenshots].sort((a, b) => compare(a, b) || compareNewest(a, b));
}

/**
 * The screenshots `filter` keeps, the collection itself for `all`.
 */
export function filterScreenshots(
  screenshots: readonly DashboardScreenshot[],
  filter: DashboardFilter
): readonly DashboardScreenshot[] {
  if (filter == 'all') {
    return screenshots;
  }

  if (filter == 'unranked') {
    return screenshots.filter(screenshot => screenshot.rank == null);
  }

  return screenshots.filter(screenshot => screenshot.rank == filter);
}

/**
 * Counts what each filter shows:
 * the whole collection, the medals per tier, and the screenshots without one.
 */
export function tallyMedals(screenshots: readonly DashboardScreenshot[]): MedalTally {
  const tally: Record<DashboardFilter, number> = {
    all: screenshots.length,
    unranked: 0,
    bronze: 0,
    silver: 0,
    gold: 0,
    platinum: 0,
    diamond: 0
  };

  for (const screenshot of screenshots) {
    tally[screenshot.rank ?? 'unranked']++;
  }

  return tally;
}

export function selectMedalState(
  screenshot: Pick<DashboardScreenshot, 'rank' | 'uniqueViewsCount'>,
  stats: Pick<CreatorStats, 'rankMinUniqueViewsCount' | 'rankMinLikesCount'>
): MedalState {
  if (screenshot.rank != null) {
    return { kind: 'ranked', rank: screenshot.rank };
  }

  if (screenshot.uniqueViewsCount < stats.rankMinUniqueViewsCount) {
    return {
      kind: 'settling',
      uniqueViewsCount: screenshot.uniqueViewsCount,
      minUniqueViewsCount: stats.rankMinUniqueViewsCount
    };
  }

  return { kind: 'noMedal', minLikesCount: stats.rankMinLikesCount };
}

/**
 * Splits the collection into the grid's rows of `perRow` items, the last one holding what is left.
 */
export function chunkRows<T>(items: readonly T[], perRow: number): ReadonlyArray<readonly T[]> {
  const rows: Array<readonly T[]> = [];

  for (let start = 0; start < items.length; start += perRow) {
    rows.push(items.slice(start, start + perRow));
  }

  return rows;
}

/**
 * The ratio the server ranks by, likes over unique views, unrounded:
 * screenshots a rounded percentage would tie still sort apart.
 */
export function likeRate(screenshot: DashboardScreenshot): number {
  return screenshot.uniqueViewsCount > 0 ? screenshot.likesCount / screenshot.uniqueViewsCount : 0;
}

type Comparator = (a: DashboardScreenshot, b: DashboardScreenshot) => number;

const comparators: Readonly<Record<DashboardSort, Comparator>> = {
  newest: compareNewest,
  oldest: (a, b) => compareNewest(b, a),
  mostLiked: (a, b) => b.likesCount - a.likesCount,
  leastLiked: (a, b) => a.likesCount - b.likesCount,
  mostViewed: (a, b) => b.uniqueViewsCount - a.uniqueViewsCount,
  bestRank: (a, b) => rankOrder(b) - rankOrder(a) || likeRate(b) - likeRate(a)
};

/**
 * The ID breaks a tie of the same second, a server ID growing with its creation time.
 */
function compareNewest(a: DashboardScreenshot, b: DashboardScreenshot): number {
  const byDate = createdAtTime(b) - createdAtTime(a);

  if (byDate != 0) {
    return byDate;
  }

  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * Each screenshot's creation date as a timestamp, parsed once rather than at every comparison:
 * every order falls back to newest first on a tie.
 */
const createdAtTimes = new WeakMap<DashboardScreenshot, number>();

function createdAtTime(screenshot: DashboardScreenshot): number {
  let time = createdAtTimes.get(screenshot);

  if (time == null) {
    time = Date.parse(screenshot.createdAt);

    createdAtTimes.set(screenshot, time);
  }

  return time;
}

/**
 * The medal's place in the ladder, an unranked screenshot below every medal.
 */
function rankOrder(screenshot: DashboardScreenshot): number {
  return screenshot.rank == null ? -1 : screenshotRanks.indexOf(screenshot.rank);
}
