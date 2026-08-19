import classNames from 'classnames';
import { LocalizedString } from 'cs2/l10n';
import { Dropdown, DropdownItem } from 'cs2/ui';
import { memo, type ReactElement, useCallback } from 'react';
import { Tooltip } from '../../components/tooltip';
import flagSolidSrc from '../../icons/fontawesome/flag-solid.svg';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { defaultButtonSounds } from '../../vanilla-modules/game-ui/common/input/button/button';
import { columnDropdownMenuTheme, iconTintFromStylesheet } from './dropdown-menu';
import { MenuControlsMoreActionsButton } from './nav-buttons';
import * as styles from './more-actions-menu.module.scss';

// The vanilla glyphs the items use, named here so the preload list below and the items themselves
// cannot end up pointing at different files.
const saveSrc = 'Media/Editor/Save.svg';
const progressSrc = 'Media/Glyphs/Progress.svg';
const gearSrc = 'Media/Glyphs/Gear.svg';

/**
 * Every icon this menu can show, for the preloading the controls do on its behalf.
 *
 * None of them is on screen until the popup opens, and the save glyph swaps mid-interaction, so
 * each is otherwise fetched on the frame it is meant to be drawn. Keep this in step with the items
 * below.
 */
// oxlint-disable-next-line react/only-export-components - no Fast Refresh in a Cohtml bundle
export const moreActionsPreloadedIcons: readonly string[] = [
  flagSolidSrc,
  saveSrc,
  gearSrc,
  progressSrc
];

/**
 * The secondary actions on the current screenshot, behind the round more-actions button.
 */
export const MenuControlsMoreActionsMenu = memo(
  ({
    isSaving,
    saveDirectory
  }: Readonly<{
    isSaving: boolean;
    saveDirectory: string;
  }>): ReactElement => {
    const translate = useTranslate();

    const openGeneralModSettings = useCallback(() => bindings.openModSettings('General'), []);

    return (
      <Dropdown
        theme={columnDropdownMenuTheme}
        content={
          <>
            <Tooltip
              direction='right'
              tooltip={
                <LocalizedString
                  id='HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Save]'
                  args={{ DIRECTORY: saveDirectory }}
                />
              }>
              {/*
                The one item that keeps the menu open on select: saving reports its progress
                through this very item, which the default close would take off screen on the
                frame the player asked for it.
              */}
              <DropdownItem<string>
                value='save'
                className={classNames({ [styles.spinningIcon]: isSaving })}
                icon={isSaving ? progressSrc : saveSrc}
                iconTint={iconTintFromStylesheet}
                disabled={isSaving}
                closeOnSelect={false}
                onChange={bindings.saveScreenshot}>
                {translate('HallOfFame.UI.Menu.MenuControls.ACTION[Save]')}
              </DropdownItem>
            </Tooltip>

            <Tooltip
              direction='right'
              tooltip={translate('HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Report]')}>
              <DropdownItem<string>
                value='report'
                icon={flagSolidSrc}
                iconTint={iconTintFromStylesheet}
                // `hover` is what a dropdown item silences relative to a plain button, so it is
                // part of the base here rather than an omission.
                sounds={{ ...defaultButtonSounds, hover: null, select: 'bulldoze' }}
                onChange={bindings.reportScreenshot}>
                {translate('HallOfFame.UI.Menu.MenuControls.ACTION[Report]')}
              </DropdownItem>
            </Tooltip>

            <DropdownItem<string>
              value='settings'
              icon={gearSrc}
              iconTint={iconTintFromStylesheet}
              onChange={openGeneralModSettings}>
              {translate('HallOfFame.UI.Menu.MenuControls.ACTION[Open Mod Settings]')}
            </DropdownItem>
          </>
        }>
        <MenuControlsMoreActionsButton />
      </Dropdown>
    );
  }
);
