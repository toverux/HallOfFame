import classNames from 'classnames';
import { LocalizedString } from 'cs2/l10n';
import { Button, Icon } from 'cs2/ui';
import { type ReactElement, useCallback, useMemo, useState } from 'react';
import { PreloadImages } from '../../components/preload-images';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { cityNamePreloadedIcons, MenuControlsCityName } from './city-name';
import { detailsRowPreloadedIcons, MenuControlsDetailsRow } from './details-row';
import { MenuControlsError } from './error';
import { MenuControlsMoreActionsMenu, moreActionsPreloadedIcons } from './more-actions-menu';
import {
  MenuControlsLikeButton,
  MenuControlsNextButton,
  MenuControlsPreviousButton,
  MenuControlsToggleMenuVisibilityButton,
  navButtonsPreloadedIcons
} from './nav-buttons';
import { selectScreenshotDetails } from './screenshot-details';
import {
  type DetailsTabId,
  detailsTabsPreloadedIcons,
  ScreenshotDetailsWindow
} from './screenshot-details-window';
import { MenuControlsScreenshotLabels } from './screenshot-labels';
import { MenuControlsSocialsPreloader } from './socials-preloader';
import { useDetailsContext } from './use-details-context';
import { useMenuControlsInputAction } from './use-menu-controls-input-action';
import { viewerLinkPreloadedIcons } from './viewer-link';
import * as styles from './menu-controls.module.scss';

const screenshotDetailsInputAction = bindings.bindInputAction(
  'hallOfFame.slideshow',
  'screenshotDetailsInputAction'
);

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
  ...cityNamePreloadedIcons,
  ...detailsRowPreloadedIcons,
  ...detailsTabsPreloadedIcons
];

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

  // The tab the details window is open on, `undefined` while it is closed.
  const [detailsTab, setDetailsTab] = useState<DetailsTabId | undefined>();

  const closeDetails = useCallback(() => setDetailsTab(undefined), []);

  const detailsInputBinding = screenshotDetailsInputAction.useInputBinding();

  // `undefined` while the error view or the empty state below take the controls' place.
  const shownScreenshotId = menuState.loadError ? undefined : menuState.screenshot?.id;

  // The key opens the window whether or not the details row shows, so it does the same thing on
  // every screenshot, and closes it again.
  useMenuControlsInputAction(
    screenshotDetailsInputAction.useInputPhase(),
    () => {
      if (shownScreenshotId == undefined) {
        return false;
      }

      setDetailsTab(tab => (tab == undefined ? 'description' : undefined));

      return true;
    },
    'select-item'
  );

  // The window closes whenever the screenshot it shows goes: on navigation, and when the error view
  // or the empty state take the controls' place, which would otherwise unmount it unclosed and
  // leave it to pop back open on the next screenshot.
  const [detailsScreenshotId, setDetailsScreenshotId] = useState(shownScreenshotId);

  if (shownScreenshotId != detailsScreenshotId) {
    setDetailsScreenshotId(shownScreenshotId);
    setDetailsTab(undefined);
  }

  const detailsContext = useDetailsContext();

  // Memoized on the screenshot, so the memoized row and labels keep their props across the renders
  // the rest of the slideshow state causes.
  const details = useMemo(
    () => menuState.screenshot && selectScreenshotDetails(menuState.screenshot, detailsContext),
    [menuState.screenshot, detailsContext]
  );

  // Without a description to preview, the row is only icons, a pill among the labels; with one, it
  // takes a line of its own. The setting hides only the row: the key still opens the window.
  const detailsRow = useMemo(
    () =>
      modSettings.showScreenshotDetails &&
      details?.row && (
        <MenuControlsDetailsRow
          row={details.row}
          inputBinding={detailsInputBinding}
          onOpen={setDetailsTab}
        />
      ),
    [modSettings.showScreenshotDetails, details, detailsInputBinding]
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

  if (!menuState.screenshot || !details) {
    return <></>;
  }

  return (
    <div className={classNames(styles.controls, styles.controlsApplyButtonsOffset)}>
      <ScreenshotDetailsWindow
        screenshot={menuState.screenshot}
        openTab={detailsTab}
        onClose={closeDetails}
      />

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

          <MenuControlsScreenshotLabels modSettings={modSettings} screenshot={menuState.screenshot}>
            {details.row?.preview == undefined && detailsRow}
          </MenuControlsScreenshotLabels>

          {details.row?.preview != undefined && detailsRow}
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
