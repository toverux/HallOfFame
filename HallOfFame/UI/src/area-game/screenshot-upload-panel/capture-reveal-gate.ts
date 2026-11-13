import { useEffect, useState } from 'react';
import * as bindings from '../../utils/bindings';
import { useCaptureVeilPhase } from '../capture-veil-phase';

// Louder than the game plays it: the panel slides in with nothing else to announce it.
const REVEAL_SOUND_VOLUME = 2.2;

/**
 * Gates the capture upload panel's reveal behind the veil of the press, so the panel never enters
 * under it, then plays the reveal sound; a panel already revealed stays so under the veil of a
 * later press.
 * The preview is a live texture, which the UI shows in the frame it asks for it, so there is no
 * image to wait for.
 * Each capture has a unique preview URI, so the gate reopens per capture.
 *
 * @param previewImageUri The current capture's preview URI, or `null` when no capture is active.
 *
 * @returns Whether the panel may be revealed now.
 */
export function useCaptureRevealGate(previewImageUri: string | null): boolean {
  const [veilPhase] = useCaptureVeilPhase();

  // The last URI revealed, which keeps its panel on screen whatever the veil does next.
  const [revealedUri, setRevealedUri] = useState<string | null>(null);

  useEffect(() => {
    if (veilPhase == 'hidden') {
      // oxlint-disable-next-line react/set-state-in-effect - latching the reveal is the effect's job
      setRevealedUri(previewImageUri);
    }
  }, [veilPhase, previewImageUri]);

  // Revealed in the render the veil leaves, not after the latching effect, which is a frame later.
  const isRevealed =
    previewImageUri != null && (revealedUri == previewImageUri || veilPhase == 'hidden');

  // Once per capture, as its URI starts gated again.
  useEffect(() => {
    if (isRevealed) {
      bindings.playSound('open-panel', REVEAL_SOUND_VOLUME);
    }
  }, [isRevealed]);

  return isRevealed;
}
