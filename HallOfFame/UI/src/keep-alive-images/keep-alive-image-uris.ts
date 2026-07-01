import type { Screenshot } from '../common';
import { deriveImageUri, type ModSettings } from '../utils/bindings';

/**
 * Screenshots eligible to be kept resident: the current one plus its window neighbors.
 */
export interface KeepAliveScreenshots {
  readonly current: Screenshot | null;
  readonly prev: Screenshot | null;
  readonly next: Screenshot | null;
}

/**
 * Computes the ordered set of image URIs to keep resident in hidden DOM nodes so cohtml never
 * evicts them (see the image-cache model: a live DOM reference, even hidden, is exempt from
 * eviction).
 *
 * In the main menu, prev/current/next are all pinned, so Next/Previous to an in-window image is
 * instant, and returning from a menu sub-screen re-shows the same screenshot with no flicker.
 * While playing, only the current (last displayed) image is pinned, so returning to the menu
 * reseeds it instantly before the fresh screenshot fades in, without holding the two neighbors'
 * memory during gameplay.
 *
 * Nulls are skipped, and each surviving screenshot is resolved through {@link deriveImageUri} so
 * the kept variant follows the resolution setting.
 */
export function keepAliveImageUris(
  screenshots: KeepAliveScreenshots,
  isInMainMenu: boolean,
  settings: ModSettings
): string[] {
  const { current, prev, next } = screenshots;

  const eligible = isInMainMenu ? [prev, current, next] : [current];

  return eligible
    .map(screenshot => deriveImageUri(screenshot, settings))
    .filter((uri): uri is string => uri != null);
}
