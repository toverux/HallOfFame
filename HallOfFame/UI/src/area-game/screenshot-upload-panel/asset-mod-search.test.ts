/* oxlint-disable no-magic-numbers - expected highlight ranges are literal string offsets */

import { describe, expect, it } from 'bun:test';
import type * as bindings from '../../utils/bindings';
import { searchAssetMods } from './asset-mod-search';

const mods = [
  createMod('Realistic Trees Pack', 'toverux'),
  createMod('Roundabout Builder', 'Quboid'),
  createMod('Traffic', 'Krzychu1245'),
  createMod('自然景观包', '玩家一号'),
  createMod('Дороги России', 'Иван')
];

describe('searchAssetMods', () => {
  it(`keeps every mod in order on an empty needle`, () => {
    expect(searchAssetMods(mods, '  ').map(match => match.mod)).toEqual(mods);
  });

  it(`matches on the display name and reports its highlight ranges`, () => {
    const [match, ...rest] = searchAssetMods(mods, 'trees');

    expect(rest).toBeEmpty();
    expect(match?.mod.displayName).toBe('Realistic Trees Pack');
    expect(match?.displayNameRanges).toEqual([[10, 15]]);
    expect(match?.authorRanges).toBeEmpty();
  });

  it(`matches on the author and reports ranges relative to the author alone`, () => {
    const [match, ...rest] = searchAssetMods(mods, 'quboid');

    expect(rest).toBeEmpty();
    expect(match?.mod.author).toBe('Quboid');
    expect(match?.displayNameRanges).toBeEmpty();
    expect(match?.authorRanges).toEqual([[0, 6]]);
  });

  it(`matches a multi-term needle spanning both fields`, () => {
    const [match, ...rest] = searchAssetMods(mods, 'pack toverux');

    expect(rest).toBeEmpty();
    expect(match?.displayNameRanges).toEqual([[16, 20]]);
    expect(match?.authorRanges).toEqual([[0, 7]]);
  });

  it(`does not let a single term match across the field separator`, () => {
    // "Packtoverux" only exists as the joined haystack entry, never within one field.
    expect(searchAssetMods(mods, 'packtoverux')).toBeEmpty();
  });

  it(`tolerates a single typo per term`, () => {
    expect(searchAssetMods(mods, 'roundabuot')[0]?.mod.displayName).toBe('Roundabout Builder');
    expect(searchAssetMods(mods, 'trafic')[0]?.mod.displayName).toBe('Traffic');
  });

  it(`searches names written in a non-Latin script`, () => {
    expect(searchAssetMods(mods, '景观')[0]?.mod.displayName).toBe('自然景观包');
    expect(searchAssetMods(mods, 'дороги')[0]?.mod.displayName).toBe('Дороги России');
    expect(searchAssetMods(mods, '玩家')[0]?.mod.author).toBe('玩家一号');
  });

  it(`returns nothing when no mod matches`, () => {
    expect(searchAssetMods(mods, 'zzzz')).toBeEmpty();
  });

  it(`treats a leading dash as text, not as uFuzzy's exclusion syntax`, () => {
    expect(searchAssetMods(mods, '-trees').map(match => match.mod.displayName)).toEqual([
      'Realistic Trees Pack'
    ]);
  });

  it(`keeps a dash inside a word searchable`, () => {
    const hyphenated = [createMod('Move-It', 'Quboid')];

    expect(searchAssetMods(hyphenated, 'move-it')).toHaveLength(1);
  });

  it(`keeps every mod on a needle holding no searchable term`, () => {
    for (const needle of ['...', '-', '((', '[']) {
      expect(searchAssetMods(mods, needle).map(match => match.mod)).toEqual(mods);
    }
  });

  it(`keeps matches past the ranking threshold, unranked and unhighlighted`, () => {
    const manyMods = Array.from({ length: 150 }, (_, index) =>
      createMod(`Road Pack ${index}`, 'toverux')
    );

    const matches = searchAssetMods(manyMods, 'road');

    expect(matches).toHaveLength(manyMods.length);
    expect(matches.every(match => match.displayNameRanges.length == 0)).toBeTrue();
  });
});

function createMod(displayName: string, author: string): bindings.JsonMod {
  return { id: displayName, displayName, author, thumbnailPath: '' };
}
