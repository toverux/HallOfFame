import { describe, expect, it } from 'bun:test';
import { type LocalizableName, selectLocalizedName } from './select-localized-name';

// A Japanese name with both romanized and translated variants, sourced from the `ja` locale.
const tokyo: LocalizableName = {
  value: '東京',
  latinized: 'Toukyou',
  translated: 'Tokyo',
  locale: 'ja'
};

describe('selectLocalizedName', () => {
  it(`uses the native value and is not translated when the mode is disabled`, () => {
    const result = selectLocalizedName('disabled', 'en-US', tokyo);

    expect(result.name).toBe('東京');
    expect(result.isTranslated).toBe(false);
  });

  it(`uses the native value when the name has no source locale`, () => {
    const result = selectLocalizedName('translate', 'en-US', { ...tokyo, locale: null });

    expect(result.name).toBe('東京');
    expect(result.isTranslated).toBe(false);
  });

  it(`uses the native value when the game locale matches the name locale`, () => {
    const result = selectLocalizedName('translate', 'ja-JP', tokyo);

    expect(result.name).toBe('東京');
    expect(result.isTranslated).toBe(false);
  });

  it(`picks the romanized form in transliterate mode for a foreign locale`, () => {
    const result = selectLocalizedName('transliterate', 'en-US', tokyo);

    expect(result.name).toBe('Toukyou');
    expect(result.isTranslated).toBe(true);
    // The tooltip's "other" form is the translation when transliterating.
    expect(result.alternate).toBe('Tokyo');
  });

  it(`picks the translated form in translate mode for a foreign locale`, () => {
    const result = selectLocalizedName('translate', 'en-US', tokyo);

    expect(result.name).toBe('Tokyo');
    expect(result.isTranslated).toBe(true);
    // The tooltip's "other" form is the romanization when translating.
    expect(result.alternate).toBe('Toukyou');
  });

  it(`returns a null name when the chosen variant is missing, leaving the fallback to the caller`, () => {
    const result = selectLocalizedName('transliterate', 'en-US', { ...tokyo, latinized: null });

    expect(result.name).toBeNull();
    expect(result.isTranslated).toBe(true);
  });
});
