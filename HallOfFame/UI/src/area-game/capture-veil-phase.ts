import { createSingletonHook } from '../utils';

/**
 * The phase of the veil a press of the take-picture button covers the capture's freeze with:
 * `shown` until the capture's frame is over, then `fading`, then `hidden`.
 */
export type CaptureVeilPhase = 'hidden' | 'shown' | 'fading';

/**
 * The veil's phase, shared by the take-picture button, which drives it, and the upload panel, whose
 * reveal waits for the veil to be gone.
 */
export const useCaptureVeilPhase = createSingletonHook<CaptureVeilPhase>('hidden');
