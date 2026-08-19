import classNames from 'classnames';
import { LocalizedString } from 'cs2/l10n';
import { Button, Icon } from 'cs2/ui';
import { type ReactElement, useCallback, useEffect } from 'react';
import { PreloadImages } from '../../components/preload-images';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { cityNamePreloadedIcons, MenuControlsCityName } from './city-name';
import { MenuControlsError } from './error';
import { MenuControlsMoreActionsMenu, moreActionsPreloadedIcons } from './more-actions-menu';
import {
  MenuControlsLikeButton,
  MenuControlsNextButton,
  MenuControlsPreviousButton,
  MenuControlsToggleMenuVisibilityButton,
  navButtonsPreloadedIcons
} from './nav-buttons';
import { MenuControlsScreenshotLabels } from './screenshot-labels';
import { MenuControlsSocialsPreloader } from './socials-preloader';
import { viewerLinkPreloadedIcons } from './viewer-link';
import * as styles from './menu-controls.module.scss';

// The icons the controls only show on demand, gathered from the components that own them.
//
// They are preloaded from here rather than from those components because this is the one node that
// outlives every popup and every screenshot: an icon pinned from inside a menu would be pinned only
// once that menu was already open, which is the frame it was needed, and one pinned from inside the
// city name would be unpinned again on the next slide.
const preloadedIcons: readonly string[] = [
  ...navButtonsPreloadedIcons,
  ...moreActionsPreloadedIcons,
  ...viewerLinkPreloadedIcons,
  ...cityNamePreloadedIcons
];

// Deliberately module-scoped, not a per-instance `useRef`. `MenuControls` is mounted via a
// portal in `MasterScreenPortal` and remounts fresh when returning to the menu from a game.
// C# bumps `forcedRefreshIndex` on exactly that transition to request a new screenshot, so the
// value must outlive the remount: a `useRef` would reset to 0, and the return-to-menu refresh
// would never fire. The right place to revisit this C#<->UI refresh round-trip is the
// SlideshowConductor (architecture candidate #1).
let lastForcedRefreshIndex = 0;

/**
 * Component that renders the menu controls and city/creator information.
 */
export function MenuControls(): ReactElement {
  return (
    <div className={styles.controlsContainer}>
      <PreloadImages srcs={preloadedIcons} />

      <MenuControlsSocialsPreloader />

      {/* Subcomponent just to avoid one stupid level of indentation! */}
      <MenuControlsContent />
    </div>
  );
}

export function MenuControlsContent(): ReactElement {
  const translate = useTranslate();

  const modSettings = bindings.useModSettings();

  const [menuState, setMenuState] = bindings.useHofMenuState();

  useEffect(() => {
    if (menuState.forcedRefreshIndex != lastForcedRefreshIndex) {
      // oxlint-disable-next-line no-magic-numbers
      setTimeout(() => bindings.nextScreenshot(), 500);
      lastForcedRefreshIndex = menuState.forcedRefreshIndex;
    }
  }, [menuState.forcedRefreshIndex]);

  const openShowcasedModPage = useCallback(
    // oxlint-disable-next-line typescript/no-non-null-assertion - set when asset button renders
    () => bindings.openModPage(menuState.screenshot!.showcasedMod!),
    [menuState.screenshot]
  );

  // Stable thanks to the functional update and the singleton's stable setter, so the memoized
  // toggle button only re-renders when `isMenuVisible` actually changes.
  const toggleMenuVisibility = useCallback(
    () => setMenuState(prev => ({ ...prev, isMenuVisible: !prev.isMenuVisible })),
    [setMenuState]
  );

  if (menuState.loadError) {
    // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
    return (
      <div className={styles.controls}>
        <MenuControlsError
          error={menuState.loadError}
          isReadyForNextImage={menuState.isReadyForNextImage}
        />
      </div>
    );
  }

  if (!menuState.screenshot) {
    return <></>;
  }

  return (
    <div className={classNames(styles.controls, styles.controlsApplyButtonsOffset)}>
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

        <div className={styles.controlsLikesCount}>
          <span className={styles.controlsLikesCountNumber}>
            {menuState.screenshot.likesCount < 1000
              ? menuState.screenshot.likesCount
              : `${(menuState.screenshot.likesCount / 1000).toFixed(1)} k`}
          </span>
          {' ' /* Thin space, preserving the former &thinsp; entity's narrow gap. */}
          {translate(
            menuState.screenshot.likesCount == 0
              ? 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Zero]'
              : menuState.screenshot.likesCount == 1
                ? 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Singular]'
                : 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Plural]'
          )}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionButtons}>
          <MenuControlsMoreActionsMenu
            isSaving={menuState.isSaving}
            saveDirectory={modSettings.creatorsScreenshotSaveDirectory}
          />
        </div>
      </div>
    </div>
  );
}
