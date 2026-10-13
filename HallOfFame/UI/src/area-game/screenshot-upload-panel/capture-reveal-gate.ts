import { useCallback, useEffect } from 'react';
import { iconsole } from '../../iconsole';
import { useImageLoaded } from '../../utils';
import * as bindings from '../../utils/bindings';

/**
 * Gates the capture upload panel's reveal behind decoding its preview image.
 *
 * The panel plays an entrance animation, and decoding a large preview mid-animation stutters, so
 * the panel stays hidden until the preview is preloaded, then reveals (the animation runs against
 * an already-decoded image) and plays the shutter sound.
 * Each capture has a unique `?v` preview URI, so the gate reopens per capture.
 *
 * @param previewImageUri The current capture's preview URI, or `null` when no capture is active.
 * @param preloadImage Injectable preloader seam; the caller wires defaults.
 *
 * @returns Whether the panel may be revealed now.
 */
export function useCaptureRevealGate(
  previewImageUri: string | null,
  preloadImage: (url: string) => Promise<void>
): boolean {
  // A failed preload still reveals the panel, but is worth a log.
  const preloadOrLog = useCallback(
    async (url: string): Promise<void> => {
      try {
        await preloadImage(url);
      } catch (error) {
        iconsole.error(`HoF: Failed to preload capture preview "${url}".`, error);
      }
    },
    [preloadImage]
  );

  const isRevealed = useImageLoaded(previewImageUri, preloadOrLog);

  // Once per capture, as its URI starts gated again.
  useEffect(() => {
    if (isRevealed) {
      bindings.playSound('take-photo');
    }
  }, [isRevealed]);

  return isRevealed;
}
