import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';
import { iconsole } from '../../iconsole';
import { createFakePreloader } from '../../testing/fixtures';
import { getTriggers, resetBindings } from '../../testing/game-setup';
import { useCaptureRevealGate } from './capture-reveal-gate';

afterEach(() => {
  cleanup();
  resetBindings();
});

describe('useCaptureRevealGate', () => {
  it(`stays gated until the preview loads, then reveals and plays the shutter sound`, async () => {
    const fake = createFakePreloader();

    const { result } = renderHook(() => useCaptureRevealGate('preview?v=1', fake.preload));

    // Gated shut while the preview decodes; the preload was requested, but the sound has not fired.
    expect(result.current).toBe(false);
    expect(fake.calls).toHaveLength(1);
    expect(shutterSoundCount()).toBe(0);

    await act(async () => fake.resolveLast('preview?v=1'));

    // Revealed once decoded, and the shutter sound fired exactly once on reveal.
    expect(result.current).toBe(true);
    expect(shutterSoundCount()).toBe(1);
  });

  it(`reveals anyway and still plays the sound when the preview preload fails`, async () => {
    const errorSpy = spyOn(iconsole, 'error').mockImplementation(() => undefined);

    const fake = createFakePreloader();

    const { result } = renderHook(() => useCaptureRevealGate('preview?v=1', fake.preload));

    await act(async () => fake.rejectLast('preview?v=1'));

    // The failed preload does not trap the panel closed: it reveals, still plays the shutter sound,
    // and logs the failure once.
    expect(result.current).toBe(true);
    expect(shutterSoundCount()).toBe(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it(`stays gated when there is no active capture`, () => {
    const fake = createFakePreloader();

    const { result } = renderHook(() => useCaptureRevealGate(null, fake.preload));

    expect(result.current).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });
});

/**
 * Count of shutter-sound plays. Filters to `take-photo` specifically among the audio triggers.
 */
function shutterSoundCount(): number {
  return getTriggers().filter(
    trigger => trigger.event == 'audio.playSound' && trigger.args[0] == 'take-photo'
  ).length;
}
