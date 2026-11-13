import { afterEach, describe, expect, it } from 'bun:test';
import { act, cleanup, renderHook } from '@testing-library/react';
import { getTriggers, resetBindings } from '../../testing/game-setup';
import { useCaptureVeilPhase } from '../capture-veil-phase';
import { useCaptureRevealGate } from './capture-reveal-gate';

afterEach(() => {
  setVeilPhase('hidden');
  cleanup();
  resetBindings();
});

describe('useCaptureRevealGate', () => {
  it(`reveals a capture at once when no veil is up, and plays the reveal sound once`, () => {
    const { result } = renderHook(() => useCaptureRevealGate('preview-1'));

    expect(result.current).toBe(true);
    expect(revealSoundCount()).toBe(1);
  });

  it(`waits for the capture veil to be gone before revealing`, () => {
    setVeilPhase('fading');

    const { result } = renderHook(() => useCaptureRevealGate('preview-1'));

    expect(result.current).toBe(false);
    expect(revealSoundCount()).toBe(0);

    setVeilPhase('hidden');

    expect(result.current).toBe(true);
    expect(revealSoundCount()).toBe(1);
  });

  it(`stays revealed under the veil of a later press`, () => {
    const { result } = renderHook(() => useCaptureRevealGate('preview-1'));

    setVeilPhase('shown');

    expect(result.current).toBe(true);

    setVeilPhase('hidden');

    expect(result.current).toBe(true);
    expect(revealSoundCount()).toBe(1);
  });

  it(`gates a new capture behind its own veil`, () => {
    let uri = 'preview-1';

    const { result, rerender } = renderHook(() => useCaptureRevealGate(uri));

    setVeilPhase('shown');

    uri = 'preview-2';
    rerender();

    expect(result.current).toBe(false);

    setVeilPhase('hidden');

    expect(result.current).toBe(true);
    expect(revealSoundCount()).toBe(2);
  });

  it(`stays gated when there is no active capture`, () => {
    const { result } = renderHook(() => useCaptureRevealGate(null));

    expect(result.current).toBe(false);
    expect(revealSoundCount()).toBe(0);
  });
});

/**
 * Sets the capture veil's shared phase, as the take-picture button does.
 */
function setVeilPhase(phase: 'hidden' | 'shown' | 'fading'): void {
  const { result, unmount } = renderHook(() => useCaptureVeilPhase());

  act(() => result.current[1](phase));
  unmount();
}

/**
 * Count of reveal-sound plays. Filters to `open-panel` specifically among the audio triggers.
 */
function revealSoundCount(): number {
  return getTriggers().filter(
    trigger => trigger.event == 'audio.playSound' && trigger.args[0] == 'open-panel'
  ).length;
}
