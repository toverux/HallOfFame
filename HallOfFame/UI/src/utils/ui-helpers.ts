import { trigger } from 'cs2/api';
import type { UISound } from 'cs2/ui';
import type { DOMAttributes } from 'react';
import { iconsole } from '../iconsole';

/**
 * Based on a hot take from John Carmack, see
 * {@link https://x.com/ID_AA_Carmack/status/1787850053912064005} or
 * {@link https://www.youtube.com/watch?v=yaMGtiPckAQ}.
 * This function replaces onSelect or onClick with onMouseDown to make the UI feel more responsive.
 * Unlike Carmack, I think onClick is still better as a default, but I agree that onMouseDown is
 * nice for low-stakes interactions and games, as the difference is really noticeable and pleasant.
 */
export function snappyOnSelect(handler: () => void, sound?: `${UISound}`) {
  return {
    onMouseDown(): void {
      handler();

      trigger('audio', 'playSound', sound ?? ('select-item' satisfies `${UISound}`), 1);
    }
  } satisfies DOMAttributes<Element>;
}

/**
 * Shows an error dialog and logs the error in the mod's logs instead of just in UI logs.
 */
export function logError(error: unknown, fatal = false): void {
  iconsole.error(error);

  const errorString = error instanceof Error ? error.stack : String(error);

  trigger('hallOfFame.common', 'logJavaScriptError', fatal, errorString);
}
