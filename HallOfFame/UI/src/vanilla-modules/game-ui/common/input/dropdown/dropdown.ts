import { type Context, createContext } from 'react';
import { getClassesModule, getModuleExport } from '../../../../../utils';

/**
 * The default dropdown theme's classes, which carry the popup's positioning and the menu's
 * structure, not just its looks.
 * A `theme` handed to `Dropdown` replaces these rather than adding to them, so a mod class has to
 * be appended to the vanilla one it skins; on its own it would leave the popup unpositioned, which
 * reads as a menu that never opens.
 */
export const vanillaDropdownClasses = getClassesModule(
  'game-ui/common/input/dropdown/themes/default.module.scss',
  ['dropdownPopup', 'dropdownMenu', 'scrollable', 'dropdownItem']
);

/**
 * Inferred from `game-ui/common/input/dropdown/dropdown.tsx`, covering the parts of the context a
 * consumer here is likely to reach for rather than only those in use today.
 */
export interface DropdownContextValue {
  readonly visible: boolean;
  readonly show: () => void;
  readonly hide: () => void;
  /**
   * Flips the menu open or shut, and plays the game's dropdown select sound.
   */
  readonly toggle: () => void;
}

/**
 * The context a vanilla `Dropdown` publishes to its subtree, which is how its toggle drives it.
 *
 * `cs2/ui` exports `DropdownToggle`, but that renders a vanilla `Button`, and in Cohtml a
 * `<button>` inherits nothing: color, font, and text-shadow are reset to the UA defaults, and no
 * CSS-wide keyword (`inherit`, `unset`, `currentColor`) brings them back.
 * A toggle that has to read as the surrounding text therefore cannot be a button, which leaves
 * reaching for the context.
 */
export const DropdownContext = getModuleExport<Context<DropdownContextValue>>(
  'game-ui/common/input/dropdown/dropdown.tsx',
  'DropdownContext',
  (value): value is Context<DropdownContextValue> =>
    value != null && typeof value == 'object' && 'Provider' in value,
  createContext<DropdownContextValue>({
    visible: false,
    show: () => {
      // No-op fallback: only reached when the vanilla module is gone and already reported.
    },
    hide: () => {
      // No-op fallback, as above.
    },
    toggle: () => {
      // No-op fallback, as above.
    }
  })
);
