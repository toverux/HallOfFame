import { describe, expect, it } from 'bun:test';
import type { DashboardScreenshot } from '../../common';
import { makeScreenshot } from '../../testing/fixtures';
import {
  chunkRows,
  collectionPlace,
  filterScreenshots,
  type DashboardSort,
  selectMedalState,
  sortScreenshots,
  tallyMedals
} from './dashboard-collection';

// The minimums the server ranks by today.
const stats = { rankMinUniqueViewsCount: 30, rankMinLikesCount: 3 };

function ids(screenshots: readonly DashboardScreenshot[]): readonly string[] {
  return screenshots.map(screenshot => screenshot.id);
}

function sorted(
  screenshots: readonly DashboardScreenshot[],
  sort: DashboardSort
): readonly string[] {
  return ids(sortScreenshots(screenshots, sort));
}

describe('sortScreenshots', () => {
  const older = makeScreenshot({ id: 'a1', createdAt: '2026-01-01T10:00:00+01:00' });

  const newer = makeScreenshot({ id: 'a2', createdAt: '2026-06-01T10:00:00+02:00' });

  it(`orders newest first by the instant, whatever the offset it is written with`, () => {
    // The same instant as `older`, written in UTC, then an hour before it.
    const sameInstant = makeScreenshot({ id: 'a0', createdAt: '2026-01-01T09:00:00Z' });

    const earlier = makeScreenshot({ id: 'b9', createdAt: '2026-01-01T09:30:00+01:00' });

    expect(sorted([earlier, older, newer, sameInstant], 'newest')).toEqual([
      'a2',
      'a1',
      'a0',
      'b9'
    ]);
  });

  it(`orders by likes, then newest first`, () => {
    const liked = makeScreenshot({ ...older, id: 'liked', likesCount: 5 });

    const tiedOlder = makeScreenshot({ ...older, likesCount: 2 });

    const tiedNewer = makeScreenshot({ ...newer, likesCount: 2 });

    expect(sorted([tiedOlder, tiedNewer, liked], 'mostLiked')).toEqual(['liked', 'a2', 'a1']);
  });

  it(`orders oldest first as the reverse of newest first`, () => {
    expect(sorted([newer, older], 'oldest')).toEqual(['a1', 'a2']);
  });

  it(`orders by fewest likes, ties still newest first`, () => {
    const liked = makeScreenshot({ ...older, id: 'liked', likesCount: 5 });

    const tiedOlder = makeScreenshot({ ...older, likesCount: 2 });

    const tiedNewer = makeScreenshot({ ...newer, likesCount: 2 });

    expect(sorted([liked, tiedOlder, tiedNewer], 'leastLiked')).toEqual(['a2', 'a1', 'liked']);
  });

  it(`orders by unique views rather than views, then newest first`, () => {
    const seen = makeScreenshot({ ...older, id: 'seen', viewsCount: 10, uniqueViewsCount: 8 });

    // More views, from fewer viewers.
    const replayed = makeScreenshot({
      ...older,
      id: 'replayed',
      viewsCount: 50,
      uniqueViewsCount: 2
    });

    const tiedOlder = makeScreenshot({ ...older, uniqueViewsCount: 2 });

    const tiedNewer = makeScreenshot({ ...newer, uniqueViewsCount: 2 });

    expect(sorted([tiedOlder, replayed, tiedNewer, seen], 'mostViewed')).toEqual([
      'seen',
      'a2',
      'replayed',
      'a1'
    ]);
  });

  it(`orders by medal, then by the exact like rate, then by likes, then newest first, unranked last`, () => {
    const diamond = makeScreenshot({
      ...older,
      id: 'diamond',
      rank: 'diamond',
      likesCount: 10,
      uniqueViewsCount: 40
    });

    // Gold, at a rate that rounds to the same 33% as the next one.
    const goldHigh = makeScreenshot({
      ...older,
      id: 'goldHigh',
      rank: 'gold',
      likesCount: 34,
      uniqueViewsCount: 102
    });

    const goldLow = makeScreenshot({
      ...newer,
      id: 'goldLow',
      rank: 'gold',
      likesCount: 33,
      uniqueViewsCount: 100
    });

    const goldTiedOlder = makeScreenshot({
      ...older,
      rank: 'gold',
      likesCount: 3,
      uniqueViewsCount: 10
    });

    const goldTiedNewer = makeScreenshot({
      ...newer,
      rank: 'gold',
      likesCount: 3,
      uniqueViewsCount: 10
    });

    // The tied pair's rate, from more likes: more viewers back it, so it comes first.
    const goldMoreLikes = makeScreenshot({
      ...older,
      id: 'goldMoreLikes',
      rank: 'gold',
      likesCount: 6,
      uniqueViewsCount: 20
    });

    // A higher rate than any gold, but a lower medal.
    const bronze = makeScreenshot({
      ...older,
      id: 'bronze',
      rank: 'bronze',
      likesCount: 9,
      uniqueViewsCount: 10
    });

    const unrankedOlder = makeScreenshot({ ...older, id: 'unrankedOlder', likesCount: 1 });

    // No viewers at all, which must not divide by zero.
    const unrankedNewer = makeScreenshot({ ...newer, id: 'unrankedNewer' });

    const collection = [
      unrankedOlder,
      goldTiedOlder,
      bronze,
      goldLow,
      unrankedNewer,
      diamond,
      goldTiedNewer,
      goldMoreLikes,
      goldHigh
    ];

    expect(sorted(collection, 'bestRank')).toEqual([
      'diamond',
      'goldHigh',
      'goldLow',
      'goldMoreLikes',
      'a2',
      'a1',
      'bronze',
      // Both at a rate of 0, the older holding the one like.
      'unrankedOlder',
      'unrankedNewer'
    ]);
  });

  it(`leaves the collection it is given as it was`, () => {
    const collection = [older, newer];

    sortScreenshots(collection, 'newest');

    expect(ids(collection)).toEqual(['a1', 'a2']);
  });
});

describe('tallyMedals', () => {
  it(`counts the collection, each medal, and the unranked together`, () => {
    const collection = [
      makeScreenshot({ rank: 'gold' }),
      makeScreenshot({ rank: 'diamond' }),
      makeScreenshot({ rank: 'gold' }),
      makeScreenshot({ rank: null, uniqueViewsCount: 3 }),
      makeScreenshot({ rank: null, uniqueViewsCount: 300 })
    ];

    expect(tallyMedals(collection)).toEqual({
      all: 5,
      unranked: 2,
      bronze: 0,
      silver: 0,
      gold: 2,
      platinum: 0,
      diamond: 1
    });
  });
});

describe('filterScreenshots', () => {
  const collection = [
    makeScreenshot({ id: 'g1', rank: 'gold' }),
    makeScreenshot({ id: 'd1', rank: 'diamond' }),
    makeScreenshot({ id: 'u1', rank: null, uniqueViewsCount: 3 }),
    makeScreenshot({ id: 'g2', rank: 'gold' }),
    makeScreenshot({ id: 'u2', rank: null, uniqueViewsCount: 300 })
  ];

  it(`keeps the whole collection for all`, () => {
    expect(filterScreenshots(collection, 'all')).toBe(collection);
  });

  it(`keeps one medal's screenshots, in their order`, () => {
    expect(ids(filterScreenshots(collection, 'gold'))).toEqual(['g1', 'g2']);
    expect(ids(filterScreenshots(collection, 'bronze'))).toEqual([]);
  });

  it(`keeps the screenshots without a medal, settling or not`, () => {
    expect(ids(filterScreenshots(collection, 'unranked'))).toEqual(['u1', 'u2']);
  });
});

describe('selectMedalState', () => {
  it(`shows the medal of a ranked screenshot`, () => {
    expect(selectMedalState({ rank: 'silver', uniqueViewsCount: 30 }, stats)).toEqual({
      kind: 'ranked',
      rank: 'silver'
    });
  });

  it(`settles while too few viewers have seen it, with their count against the minimum`, () => {
    expect(selectMedalState({ rank: null, uniqueViewsCount: 29 }, stats)).toEqual({
      kind: 'settling',
      uniqueViewsCount: 29,
      minUniqueViewsCount: 30
    });
  });

  it(`has no medal once enough viewers have seen it, with the likes a medal takes`, () => {
    expect(selectMedalState({ rank: null, uniqueViewsCount: 30 }, stats)).toEqual({
      kind: 'noMedal',
      minLikesCount: 3
    });
  });
});

describe('chunkRows', () => {
  it(`fills each row, the last one with what is left`, () => {
    expect(chunkRows(['a', 'b', 'c', 'd', 'e'], 2)).toEqual([['a', 'b'], ['c', 'd'], ['e']]);
  });

  it(`fills the last row when the items divide evenly`, () => {
    expect(chunkRows(['a', 'b', 'c', 'd'], 2)).toEqual([
      ['a', 'b'],
      ['c', 'd']
    ]);
  });

  it(`makes no row of an empty collection`, () => {
    expect(chunkRows([], 2)).toEqual([]);
  });
});

describe('collectionPlace', () => {
  it(`places each screenshot where the grid's Best medal order puts it, ties included`, () => {
    const newer = makeScreenshot({ id: 'newer', createdAt: '2026-06-01T10:00:00Z' });
    const older = makeScreenshot({ id: 'older', createdAt: '2026-01-01T10:00:00Z' });

    // The same medal, rate and likes: only their dates set them apart, as in the grid.
    const collection = [
      makeScreenshot({ ...older, rank: 'gold', likesCount: 2, uniqueViewsCount: 10 }),
      makeScreenshot({ ...newer, rank: null, likesCount: 0 }),
      makeScreenshot({ ...newer, rank: 'gold', likesCount: 2, uniqueViewsCount: 10 }),
      makeScreenshot({ ...older, rank: 'diamond', likesCount: 1, uniqueViewsCount: 10 }),
      makeScreenshot({ ...older, rank: null, likesCount: 0 })
    ];

    const places = sortScreenshots(collection, 'bestRank').map(screenshot =>
      collectionPlace(screenshot, collection)
    );

    expect(places).toEqual(collection.map((_, index) => index + 1));
  });
});
