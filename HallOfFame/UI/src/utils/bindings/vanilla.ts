import { trigger } from 'cs2/api';
import type { UISound } from 'cs2/ui';

const GROUP = 'audio';

/**
 * Plays a Vanilla sound.
 *
 * This triggers the game's own `'audio'` group, not a Hall of Fame group, which is why it lives in
 * its own module rather than in {@link common}.
 */
export function playSound(sound: `${UISound}`, volume = 1): void {
  trigger(GROUP, 'playSound', sound, volume);
}
