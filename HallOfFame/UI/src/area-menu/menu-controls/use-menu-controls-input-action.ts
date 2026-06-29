import type { UISound } from 'cs2/ui';
import { useEffect, useState } from 'react';
import * as bindings from '../../utils/bindings';

/**
 * Triggers the {@link handler} when the input is executed (key down AND key up).
 * The handler returns a boolean indicating whether the handler has executed the action (was ready
 * to do so).
 * If the handler returns `false`, it will be called again on key up.
 * Returning void (`undefined`) is equivalent to returning `true`.
 *
 * This is a very specific implementation whose sole role is to provide a good UX for the behavior
 * of the main menu control buttons.
 *
 * @param phase   The current input action phase.
 * @param handler The function to call when the input action is performed (key down) AND canceled
 *                (key up).
 * @param sound   The sound to play when the handler returned `true`.
 */
export function useMenuControlsInputAction(
  phase: bindings.InputActionPhase,
  // biome-ignore lint/suspicious/noConfusingVoidType: it's really how I want it to be here.
  handler: () => boolean | undefined | void,
  sound?: `${UISound}`
) {
  const [replayOnCanceled, setReplayOnCanceled] = useState(false);

  useEffect(() => {
    // Performed = keydown
    // Canceled = keyup
    if (phase == 'Performed' || (phase == 'Canceled' && replayOnCanceled)) {
      const ready = handler() ?? true;

      setReplayOnCanceled(phase == 'Performed' && !ready);

      if (ready && sound) {
        bindings.playSound(sound);
      }
    }
  }, [phase]);
}
