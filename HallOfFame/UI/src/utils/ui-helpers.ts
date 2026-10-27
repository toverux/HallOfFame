import type { UISound } from 'cs2/ui';
import type { DOMAttributes } from 'react';
import { iconsole } from '../iconsole';
import * as bindings from './bindings';

/**
 * Based on a hot take from John Carmack, see
 * {@link https://x.com/ID_AA_Carmack/status/1787850053912064005} or
 * {@link https://www.youtube.com/watch?v=yaMGtiPckAQ}.
 * This function replaces onSelect or onClick with onMouseDown to make the UI feel more responsive.
 * Unlike Carmack, I think onClick is still better as a default, but I agree that onMouseDown is
 * nice for low-stakes interactions and games, as the difference is really noticeable and pleasant.
 * It replaces a vanilla button's `onSelect` rather than joining it: the button's own click would
 * run the handler and play its sound a second time.
 */
export function snappyOnSelect(
  handler: () => void,
  sound?: `${UISound}`
): { onMouseDown: () => void } {
  return {
    onMouseDown(): void {
      handler();
      bindings.playSound(sound ?? 'select-item');
    }
  } satisfies DOMAttributes<Element>;
}

/**
 * Shows an error dialog and logs the error in the mod's logs instead of just in UI logs.
 */
export function logError(error: unknown, fatal = false): void {
  iconsole.error(error);

  const errorString = error instanceof Error ? error.stack : String(error);

  bindings.logJavaScriptError(fatal, errorString);
}

/**
 * `DropdownItem` types `iconTint` after the C# binding shape, where it is a color, but the `Icon`
 * it reaches takes a boolean too, and only the boolean leaves the color to CSS. An inline color
 * would win over the stylesheet and strand the icon on one shade while the label lights up.
 */
export const iconTintFromStylesheet = true as unknown as string;
