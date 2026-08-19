import type { ButtonSounds } from 'cs2/ui';
import { getModuleExport } from '../../../../../utils';

/**
 * The sounds a vanilla `Button` plays when it is selected, hovered, and focused.
 *
 * A `sounds` prop replaces this object rather than merging into it, so silencing or overriding one
 * sound means spreading these defaults and stating the difference. Reaching for the vanilla object
 * rather than restating its values keeps a game update that renames a sound from silently dropping
 * the ones the mod did not mean to touch.
 */
export const defaultButtonSounds = getModuleExport<ButtonSounds>(
  'game-ui/common/input/button/button.tsx',
  'defaultButtonSounds',
  (value): value is ButtonSounds => value != null && typeof value == 'object' && 'select' in value,
  { select: 'select-item', hover: 'hover-item', focus: 'hover-item' }
);
