/* oxlint-disable require-await, typescript/require-await - async act() callbacks flush React effects, no direct await */

import { afterEach, describe, expect, it } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createFakePreloader } from '../testing/fixtures';
import { useImageLoaded } from './use-image-loaded';

afterEach(cleanup);

describe('useImageLoaded', () => {
  it(`is ready once the preload settles, a failed one included`, async () => {
    const fake = createFakePreloader();

    const { result, rerender } = renderHook(({ url }) => useImageLoaded(url, fake.preload), {
      initialProps: { url: 'a.png' }
    });

    expect(result.current).toBe(false);

    await act(async () => fake.resolveLast('a.png'));

    expect(result.current).toBe(true);

    rerender({ url: 'b.png' });

    // A new image waits for its own load.
    expect(result.current).toBe(false);

    await act(async () => fake.rejectLast('b.png'));

    expect(result.current).toBe(true);
  });

  it(`is never ready without an image`, () => {
    const fake = createFakePreloader();

    const { result } = renderHook(() => useImageLoaded(null, fake.preload));

    expect(result.current).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});
