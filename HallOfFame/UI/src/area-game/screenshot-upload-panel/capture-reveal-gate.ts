import { useEffect, useState } from 'react';
import { iconsole } from '../../iconsole';
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
 * @returns Whether the panel may be revealed now.
 */
export function useCaptureRevealGate(
  previewImageUri: string | null,
  preloadImage: (url: string) => Promise<void>
): boolean {
  // The preview URI whose decoding has completed and may now be revealed.
  const [revealedUri, setRevealedUri] = useState<string | null>(null);

  useEffect(() => {
    if (previewImageUri == null) {
      setRevealedUri(null);

      return;
    }

    let canceled = false;

    preloadImage(previewImageUri)
      .catch((error: unknown) => {
        iconsole.error(`HoF: Failed to preload capture preview "${previewImageUri}".`, error);
      })
      .finally(() => {
        if (canceled) {
          return;
        }

        setRevealedUri(previewImageUri);

        bindings.playSound('take-photo');
      });

    return () => {
      canceled = true;
    };
  }, [previewImageUri, preloadImage]);

  return previewImageUri != null && revealedUri == previewImageUri;
}
