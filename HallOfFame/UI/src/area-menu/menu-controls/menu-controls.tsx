import classNames from 'classnames';
import { LocalizedString, useLocalization } from 'cs2/l10n';
import { Button, Icon, MenuButton, Tooltip } from 'cs2/ui';
import { type ReactElement, useCallback, useEffect, useState } from 'react';
import * as bindings from '../../bindings';
// biome-ignore-start lint/correctness/noPrivateImports: svgs don't have @public annotations
import ellipsisSolidSrc from '../../icons/fontawesome/ellipsis-solid.svg';
import flagSolidSrc from '../../icons/fontawesome/flag-solid.svg';
// biome-ignore-end lint/correctness/noPrivateImports: svgs don't have @public annotations
import { MenuControlsCityName } from './city-name';
import { MenuControlsError } from './error';
import * as styles from './menu-controls.module.scss';
import {
  MenuControlsLikeButton,
  MenuControlsNextButton,
  MenuControlsPreviousButton,
  MenuControlsToggleMenuVisibilityButton
} from './nav-buttons';
import * as navButtons from './nav-buttons.module.scss';
import { MenuControlsScreenshotLabels } from './screenshot-labels';

let lastForcedRefreshIndex = 0;

/**
 * Component that renders the menu controls and city/creator information.
 */
export function MenuControls(): ReactElement {
  return (
    <div className={styles.controlsContainer}>
      {/* Subcomponent just to avoid one stupid level of indentation! */}
      <MenuControlsContent />
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: splitting further would make it too complex.
export function MenuControlsContent(): ReactElement {
  const { translate } = useLocalization();

  const modSettings = bindings.useModSettings();

  const [menuState, setMenuState] = bindings.useHofMenuState();

  const [showMoreActions, setShowOtherActions] = useState(false);

  useEffect(() => {
    if (menuState.forcedRefreshIndex != lastForcedRefreshIndex) {
      setTimeout(() => bindings.nextScreenshot(), 500);
      lastForcedRefreshIndex = menuState.forcedRefreshIndex;
    }
  }, [menuState.forcedRefreshIndex]);

  const openShowcasedModPage = useCallback(
    // biome-ignore lint/style/noNonNullAssertion: will not be null here
    () => bindings.openModPage(menuState.screenshot!.showcasedMod!),
    [menuState.screenshot]
  );

  const toggleMoreActions = useCallback(() => setShowOtherActions(prev => !prev), []);

  const openGeneralModSettings = useCallback(() => bindings.openModSettings('General'), []);

  // Stable thanks to the functional update and the singleton's stable setter, so the memoized
  // toggle button only re-renders when `isMenuVisible` actually changes.
  const toggleMenuVisibility = useCallback(
    () => setMenuState(prev => ({ ...prev, isMenuVisible: !prev.isMenuVisible })),
    [setMenuState]
  );

  if (menuState.error) {
    // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
    return (
      <div className={styles.controls}>
        <MenuControlsError
          error={menuState.error}
          isReadyForNextImage={menuState.isReadyForNextImage}
        />
      </div>
    );
  }

  if (!menuState.screenshot) {
    // biome-ignore lint/complexity/noUselessFragments: we need to return a ReactElement.
    return <></>;
  }

  return (
    <div
      className={classNames(styles.controls, styles.controlsApplyButtonsOffset)}
      // biome-ignore lint/performance/noJsxPropsBind: host element does not bail out on prop identity
      onMouseLeave={() => setShowOtherActions(false)}>
      {modSettings.showFeaturedAsset && menuState.screenshot.showcasedMod && (
        <Button variant='menu' className={styles.assetButton} onSelect={openShowcasedModPage}>
          <div
            className={styles.assetButtonThumbnail}
            style={{ backgroundImage: `url(${menuState.screenshot.showcasedMod.thumbnailUrl})` }}
          />

          <section className={styles.assetButtonText}>
            <span className={styles.assetButtonTextHeader}>
              <Icon src='Media/Glyphs/ParadoxMods.svg' tinted={true} />
              {menuState.screenshot.showcasedMod.tags.includes('Map')
                ? translate('HallOfFame.UI.Menu.MenuControls.SHOWCASED_MAP')
                : translate('HallOfFame.UI.Menu.MenuControls.SHOWCASED_ASSET')}
            </span>

            <span className={styles.assetButtonTextTitle}>
              {menuState.screenshot.showcasedMod.name}
            </span>

            <span className={styles.assetButtonTextAuthor}>
              <LocalizedString
                id='HallOfFame.Common.CITY_BY'
                // biome-ignore lint/style/useNamingConvention: i18n convention
                args={{ CREATOR_NAME: menuState.screenshot.showcasedMod.authorName }}
              />
            </span>

            {menuState.screenshot.showcasedMod.shortDescription && (
              <span className={styles.assetButtonTextDescription}>
                {menuState.screenshot.showcasedMod.shortDescription}
              </span>
            )}
          </section>
        </Button>
      )}

      <div className={styles.section}>
        <div className={styles.sectionButtons} style={{ alignSelf: 'flex-end' }}>
          <MenuControlsNextButton isLoading={!menuState.isReadyForNextImage} />

          <MenuControlsPreviousButton
            isLoading={!menuState.isReadyForNextImage}
            hasPreviousScreenshot={menuState.hasPreviousScreenshot}
          />

          <MenuControlsToggleMenuVisibilityButton
            isMenuVisible={menuState.isMenuVisible}
            toggleMenuVisibility={toggleMenuVisibility}
          />
        </div>

        <div className={styles.sectionContent} style={{ alignSelf: 'flex-start' }}>
          <MenuControlsCityName screenshot={menuState.screenshot} />

          <MenuControlsScreenshotLabels
            modSettings={modSettings}
            screenshot={menuState.screenshot}
          />
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionButtons}>
          <MenuControlsLikeButton screenshot={menuState.screenshot} />
        </div>

        <div className={classNames(styles.sectionContent, styles.controlsLikesCount)}>
          <span className={styles.controlsLikesCountNumber}>
            {menuState.screenshot.likesCount < 1000
              ? menuState.screenshot.likesCount
              : `${(menuState.screenshot.likesCount / 1000).toFixed(1)} k`}
          </span>
          {/** biome-ignore lint/style/noJsxLiterals: it's kinda okay */}
          &thinsp;
          {translate(
            menuState.screenshot.likesCount == 0
              ? 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Zero]'
              : menuState.screenshot.likesCount == 1
                ? 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Singular]'
                : 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Plural]'
          )}
        </div>
      </div>

      <div className={classNames(styles.section, styles.sectionOtherActions)}>
        <div className={styles.sectionButtons}>
          <MenuButton
            className={navButtons.button}
            src={ellipsisSolidSrc}
            tinted={true}
            onSelect={toggleMoreActions}
          />
        </div>

        <div
          className={classNames(styles.sectionContent, {
            [styles.sectionContentSlideIn]: showMoreActions
          })}>
          <Tooltip
            direction='down'
            tooltip={
              <LocalizedString
                id='HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Save]'
                // biome-ignore lint/style/useNamingConvention: i18n convention
                args={{ DIRECTORY: modSettings.creatorsScreenshotSaveDirectory }}
              />
            }>
            <Button
              className={menuState.isSaving ? styles.sectionSaveButtonSpin : ''}
              variant='menu'
              src={menuState.isSaving ? 'Media/Glyphs/Progress.svg' : 'Media/Editor/Save.svg'}
              tinted={true}
              disabled={menuState.isSaving}
              onSelect={bindings.saveScreenshot}>
              <span>{translate('HallOfFame.UI.Menu.MenuControls.ACTION[Save]')}</span>
            </Button>
          </Tooltip>

          <Tooltip
            direction='down'
            tooltip={translate('HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Report]')}>
            <Button
              variant='menu'
              src={flagSolidSrc}
              tinted={true}
              onSelect={bindings.reportScreenshot}
              selectSound='bulldoze'>
              <span>{translate('HallOfFame.UI.Menu.MenuControls.ACTION[Report]')}</span>
            </Button>
          </Tooltip>

          <Tooltip
            direction='down'
            tooltip={translate(
              'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Open Mod Settings]'
            )}>
            <Button
              className={styles.sectionSettingsButton}
              variant='menu'
              src='Media/Glyphs/Gear.svg'
              tinted={true}
              onSelect={openGeneralModSettings}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
