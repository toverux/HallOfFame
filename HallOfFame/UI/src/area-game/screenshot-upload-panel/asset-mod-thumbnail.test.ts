import { describe, expect, it } from 'bun:test';
import { deriveModThumbnailUri as derive } from './asset-mod-thumbnail';

const cdn = 'https://modscontent.paradox-interactive.com';
const content = `${cdn}/cities_skylines_2/a1817808-995e-4eaf-a5e3-2b4cdf0633e4/content`;
const cover = `${content}/covers/cover_3`;

describe('deriveModThumbnailUri', () => {
  it(`points a cover URL at its downscaled sibling`, () => {
    expect(derive(`${cover}.jpg`)).toBe(`${cover}_thumb.jpg`);
  });

  it(`rewrites any cover index`, () => {
    expect(derive(`${content}/covers/cover_10.jpg`)).toBe(`${content}/covers/cover_10_thumb.jpg`);
  });

  it(`leaves a mod with no thumbnail alone, which the row shows as its placeholder`, () => {
    expect(derive('')).toBe('');
  });

  // A path the rewrite does not recognize has to survive untouched rather than be turned into a
  // sibling that was never generated: a locally installed mod carries a plain file path, and the
  // CDN could serve a shape this pattern has never seen.
  it.each([
    ['a local file path', 'C:/Mods/Some Mod/thumbnail.jpg'],
    ['another host', 'https://example.com/content/covers/cover_1.jpg'],
    ['a path outside covers/', `${content}/screenshots/shot_1.jpg`],
    ['a non-numbered cover', `${content}/covers/cover_main.jpg`],
    ['another extension', `${cover}.png`],
    ['an already-derived URL', `${cover}_thumb.jpg`]
  ])(`leaves %s untouched`, (_label, path) => {
    expect(derive(path)).toBe(path);
  });
});
