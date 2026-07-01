import { describe, expect, it } from 'bun:test';
import type { Screenshot } from '../common';
import { makeScreenshot, makeSettings } from '../testing/fixtures';
import { keepAliveImageUris } from './keep-alive-image-uris';

describe('keepAliveImageUris', () => {
  it(`keeps prev, current and next in the main menu`, () => {
    const uris = keepAliveImageUris(
      { prev: shot('p'), current: shot('c'), next: shot('n') },
      true,
      makeSettings({ screenshotResolution: 'fhd' })
    );

    expect(uris).toEqual(['p-fhd.png', 'c-fhd.png', 'n-fhd.png']);
  });

  it(`keeps only the current image while playing`, () => {
    const uris = keepAliveImageUris(
      { prev: shot('p'), current: shot('c'), next: shot('n') },
      false,
      makeSettings({ screenshotResolution: 'fhd' })
    );

    expect(uris).toEqual(['c-fhd.png']);
  });

  it(`skips null neighbors`, () => {
    const uris = keepAliveImageUris(
      { prev: null, current: shot('c'), next: null },
      true,
      makeSettings({ screenshotResolution: 'fhd' })
    );

    expect(uris).toEqual(['c-fhd.png']);
  });

  it(`returns an empty list when there is no current image`, () => {
    const uris = keepAliveImageUris(
      { prev: null, current: null, next: null },
      true,
      makeSettings({ screenshotResolution: 'fhd' })
    );

    expect(uris).toEqual([]);
  });

  it(`resolves the variant matching the resolution setting`, () => {
    const uris = keepAliveImageUris(
      { prev: shot('p'), current: shot('c'), next: shot('n') },
      true,
      makeSettings({ screenshotResolution: '4k' })
    );

    expect(uris).toEqual(['p-4k.png', 'c-4k.png', 'n-4k.png']);
  });
});

function shot(id: string): Screenshot {
  return makeScreenshot({ imageUrlFHD: `${id}-fhd.png`, imageUrl4K: `${id}-4k.png` });
}
