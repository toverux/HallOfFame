import type { DropdownTheme } from 'cs2/ui';
import { skinDropdownTheme } from '../../vanilla-modules/game-ui/common/input/dropdown/dropdown';
import * as styles from './dropdown-menu.module.scss';

/**
 * The mod's skin for a vanilla `Dropdown` opened over the slideshow.
 */
export const dropdownMenuTheme: Partial<DropdownTheme> = skinDropdownTheme({
  dropdownPopup: styles.menu,
  dropdownMenu: styles.menuList,
  scrollable: styles.menuScrollable,
  dropdownItem: styles.menuItem,
  // The vanilla theme carries no `icon` class, so this one stands alone rather than skinning
  // another; without it the icon falls back to the size the game gives an unstyled one.
  icon: styles.menuItemIcon
});

/**
 * {@link dropdownMenuTheme} for a menu whose toggle is one of the round buttons in the column,
 * which needs the popup moved out from under the buttons stacked above it.
 */
export const columnDropdownMenuTheme: Partial<DropdownTheme> = {
  ...dropdownMenuTheme,
  dropdownPopup: `${dropdownMenuTheme.dropdownPopup} ${styles.menuFromColumn}`
};
