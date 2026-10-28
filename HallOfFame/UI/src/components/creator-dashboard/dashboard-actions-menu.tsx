import classNames from 'classnames';
import { Dropdown, DropdownItem, type DropdownTheme, DropdownToggle, Icon } from 'cs2/ui';
import { type ReactElement, useContext } from 'react';
import type { Screenshot } from '../../common';
import externalLinkSrc from '../../icons/fontawesome/arrow-up-right-from-square-solid.svg';
import expandSolidSrc from '../../icons/fontawesome/expand-solid.svg';
import { getClassesModule, iconTintFromStylesheet, useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { defaultButtonSounds } from '../../vanilla-modules/game-ui/common/input/button/button';
import { DropdownContext } from '../../vanilla-modules/game-ui/common/input/dropdown/dropdown';
import { PreloadImages } from '../preload-images';
import * as formShared from '../screenshot-form/shared.module.scss';
import * as styles from './dashboard-actions-menu.module.scss';

// The chevron vanilla's dropdown shows closed, kept open too and turned over.
const chevronSrc = 'Media/Glyphs/StrokeArrowDown.svg';

const coDropdownTheme = getClassesModule(
  'game-ui/common/input/dropdown/themes/default.module.scss',
  [
    'dropdownItem',
    'dropdownMenu',
    'dropdownPopup',
    'dropdownToggle',
    'indicator',
    'label',
    'scrollable'
  ]
);

// The toggle a quiet action beside Save's primary; the form's dark tone on the popup, which
// vanilla mounts outside the form, as the asset picker's.
const menuTheme: DropdownTheme = {
  ...coDropdownTheme,
  dropdownToggle: classNames(coDropdownTheme.dropdownToggle, styles.menuToggle),
  indicator: classNames(coDropdownTheme.indicator, styles.menuIndicator),
  dropdownPopup: classNames(coDropdownTheme.dropdownPopup, styles.menuPopup, formShared.toneDark),
  dropdownMenu: classNames(coDropdownTheme.dropdownMenu, styles.menu),
  scrollable: classNames(coDropdownTheme.scrollable, styles.menuScrollable),
  dropdownItem: classNames(coDropdownTheme.dropdownItem, styles.menuItem),
  icon: styles.menuItemIcon
};

// The toggle spans the whole control, so its hover sound would fire on the way to anything else.
const toggleSounds = { ...defaultButtonSounds, hover: null };

// Fetched with the detail rather than on the frame the menu first opens.
const menuIcons: readonly string[] = [chevronSrc, expandSolidSrc, externalLinkSrc];

/**
 * The two ways to see the screenshot, behind a More toggle before Save in the action row.
 * Show in slideshow is offered on the main menu alone, where the slideshow shows, and held while
 * a mutation is on its way, as C# holds it: the slideshow would be handed a record about to change.
 */
export function DashboardActionsMenu({
  screenshot,
  isMutating
}: Readonly<{
  screenshot: Screenshot;
  isMutating: boolean;
}>): ReactElement {
  const translate = useTranslate();

  const isInMainMenu = bindings.useIsInMainMenu();

  // The dashboard also opens in the main menu with the slideshow off, from the options page.
  const isSlideshowEnabled = bindings.useIsSlideshowEnabled();

  return (
    <>
      <PreloadImages srcs={menuIcons} />

      <Dropdown
        theme={menuTheme}
        alignment='right'
        content={
          <>
            {isInMainMenu && isSlideshowEnabled && (
              <DropdownItem<string>
                value='slideshow'
                disabled={isMutating}
                icon={expandSolidSrc}
                iconTint={iconTintFromStylesheet}
                onChange={bindings.showDashboardScreenshotInSlideshow}>
                {translate('HallOfFame.UI.Dashboard.EDIT_ACTION[Show in Slideshow]')}
              </DropdownItem>
            )}

            <DropdownItem<string>
              value='viewer'
              icon={externalLinkSrc}
              iconTint={iconTintFromStylesheet}
              onChange={() => bindings.openViewerLink(screenshot.viewerUrl)}>
              {translate('HallOfFame.UI.Dashboard.EDIT_ACTION[Open in Web Viewer]')}
            </DropdownItem>
          </>
        }>
        <DropdownToggle
          sounds={toggleSounds}
          openIconComponent={<MenuIndicator />}
          closeIconComponent={<MenuIndicator />}>
          {translate('HallOfFame.UI.Dashboard.EDIT_ACTION[More]')}
        </DropdownToggle>
      </Dropdown>
    </>
  );
}

/**
 * The toggle's chevron, one image turned over while the menu is open: vanilla swaps it for
 * another, which flickers while that one loads.
 */
function MenuIndicator(): ReactElement {
  const { visible } = useContext(DropdownContext);

  return (
    <Icon
      src={chevronSrc}
      tinted={true}
      className={classNames(menuTheme.indicator, { [styles.menuIndicatorOpen]: visible })}
    />
  );
}
