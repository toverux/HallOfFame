import type { UISound } from 'cs2/ui';
import { useRef } from 'react';
import * as bindings from '../../utils/bindings';

/**
 * Triggers the {@link handler} when the input is executed (key down AND key up).
 * The handler returns a boolean indicating whether the handler has executed the action (was ready
 * to do so).
 * If the handler returns `false`, it will be called again on key up.
 * Returning void (`undefined`) is equivalent to returning `true`.
 *
 * This is a very specific implementation whose sole role is to provide a good UX for the behavior
 * of the main menu control buttons and the tour's key listeners.
 * The keys rest while the Creator Dashboard is open: it covers the controls, and their actions
 * reach the UI as C# input phases that its backdrop cannot consume.
 *
 * @param action The input action to listen to.
 * @param handler The function to call when the input action is performed (key down) AND canceled
 *   (key up).
 * @param sound The sound to play when the handler returned `true`.
 */
export function useMenuControlsInputAction(
  action: bindings.InputAction,
  handler: () => boolean | undefined | void,
  sound?: `${UISound}`
): void {
  // A ref, not state: a key tapped within one update changes the phase twice before any render.
  const replayOnCanceled = useRef(false);

  const isDashboardOpen = bindings.useDashboardState().status != 'closed';

  // Every phase change, not the rendered phase: React renders only the last change of an update,
  // which loses the press of a key released in the frame it came in.
  action.useInputPhaseChange(phase => {
    if (isDashboardOpen) {
      return;
    }

    // Performed = keydown
    // Canceled = keyup
    if (phase == 'Performed' || (phase == 'Canceled' && replayOnCanceled.current)) {
      const ready = handler() ?? true;

      replayOnCanceled.current = phase == 'Performed' && !ready;

      if (ready && sound) {
        bindings.playSound(sound);
      }
    }
  });
}
