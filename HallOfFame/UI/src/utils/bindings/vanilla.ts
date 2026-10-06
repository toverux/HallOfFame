import { trigger, useValue } from 'cs2/api';
import type { UISound } from 'cs2/ui';
import { lazyBindValue } from './lazy-value-binding';

// The game's own groups, not Hall of Fame ones, which is why they live in their own module rather
// than in `common`.
const AUDIO_GROUP = 'audio';

const MENU_GROUP = 'menu';

const gameVersion$ = lazyBindValue<string>(MENU_GROUP, 'gameVersion', '');

/**
 * The running game's version, as its main menu shows it: "1.6.2f1 (build.changeset) [date]".
 */
export function useGameVersion(): string {
  return useValue(gameVersion$());
}

/**
 * Plays a Vanilla sound.
 */
export function playSound(sound: `${UISound}`, volume = 1): void {
  trigger(AUDIO_GROUP, 'playSound', sound, volume);
}
