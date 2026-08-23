/* oxlint-disable typescript/no-non-null-assertion - uFuzzy's index arrays are dense and in-bounds
   by construction, indexing the haystack this module built itself */

import uFuzzy from '@leeoniya/ufuzzy';
import type * as bindings from '../../utils/bindings';

/**
 * A `[start, end)` slice of a searched field to emphasize.
 */
export type HighlightRange = readonly [start: number, end: number];

/**
 * One asset mod matching a filter, with the ranges to highlight in each searched field.
 */
export interface AssetModMatch {
  readonly mod: bindings.JsonMod;
  readonly displayNameRanges: readonly HighlightRange[];
  readonly authorRanges: readonly HighlightRange[];
}

/**
 * Joins the two searched fields into the single haystack entry uFuzzy takes.
 * It is punctuation for {@link fuzzy}, so no single term matches across it, while a multi-term
 * needle still spans both fields.
 */
const FIELD_SEPARATOR = ' | ';

/**
 * How many matches still get ranked and highlighted.
 * Past it uFuzzy returns the matches alone, which is what the first letter typed over a large
 * playset wants: ranking hundreds of equally thin matches costs far more than it tells the player.
 */
const INFO_THRESHOLD = 100;

/**
 * What uFuzzy must treat as a separator rather than as a letter: ASCII whitespace and punctuation.
 *
 * Out of the box the library is Latin-only, its regexps defining a letter as `[A-Za-z]`, which
 * turns every CJK or Cyrillic character into a term separator and makes those names unsearchable.
 * Its unicode preset fixes that with `\p{L}` property escapes, which need an ICU-enabled V8 that
 * Cohtml does not ship. Defining the separators instead of the letters gets there with plain ASCII
 * regexps.
 */
const SEPARATORS = ' \\t\\n\\r!-/:-@\\[-`{-~';

// oxlint-disable-next-line new-cap - the library's own casing
const fuzzy = new uFuzzy({
  interSplit: `[${SEPARATORS}]+`,
  interBound: `[${SEPARATORS}]`,
  intraChars: `[^${SEPARATORS}]`,

  // Tolerate one typo per term, in the order the flags below sit: one missing, one wrong, two
  // transposed, or one extra character.
  intraMode: 1,
  intraIns: 1,
  intraSub: 1,
  intraTrn: 1,
  intraDel: 1
});

/**
 * Filters and ranks asset mods on their display name and author, best match first.
 * An empty needle keeps every mod, in the order the game gave them.
 */
export function searchAssetMods(
  mods: readonly bindings.JsonMod[],
  needle: string
): AssetModMatch[] {
  const terms = withoutNegation(needle);

  if (!terms) {
    return mods.map(mod => toMatch(mod, []));
  }

  const haystack = mods.map(mod => `${mod.displayName}${FIELD_SEPARATOR}${mod.author}`);

  const [indices, info, order] = fuzzy.search(haystack, terms, 0, INFO_THRESHOLD);

  // A needle holding no term of its own, punctuation alone for instance, comes back `null`: it asks
  // for no filtering rather than for nothing.
  if (!indices) {
    return mods.map(mod => toMatch(mod, []));
  }

  // Past {@link INFO_THRESHOLD} uFuzzy stops ranking and highlighting with it; those matches are
  // still shown, unranked.
  return info && order
    ? order.map(infoIdx => toMatch(mods[info.idx[infoIdx]!]!, info.ranges[infoIdx]!))
    : indices.map(idx => toMatch(mods[idx]!, []));
}

/**
 * Defuses the leading `-` uFuzzy reads as "exclude this term", which would answer a filter with the
 * complement of what the player asked for.
 * A dash inside a word is left alone, since asset names are full of them.
 */
function withoutNegation(needle: string): string {
  return needle.replaceAll(/(?<lead>^|\s)-+/gu, '$<lead>').trim();
}

/**
 * Cuts the haystack-wide highlight ranges back into per-field ones, dropping the separator.
 */
function toMatch(mod: bindings.JsonMod, ranges: readonly number[]): AssetModMatch {
  const displayNameLength = mod.displayName.length;
  const authorStart = displayNameLength + FIELD_SEPARATOR.length;

  const displayNameRanges: HighlightRange[] = [];
  const authorRanges: HighlightRange[] = [];

  // The library gives one flat `[start0, end0, start1, end1, …]` array per haystack entry.
  for (let index = 0; index < ranges.length; index += 2) {
    const start = ranges[index]!;
    const end = ranges[index + 1]!;

    if (end <= displayNameLength) {
      displayNameRanges.push([start, end]);
    } else if (start >= authorStart) {
      authorRanges.push([start - authorStart, end - authorStart]);
    }
  }

  return { mod, displayNameRanges, authorRanges };
}
