import classNames from 'classnames';
import { InputActionConsumer } from 'cs2/input';
import {
  FormattedParagraphs,
  type FormattedTextTheme,
  Icon,
  MarkdownRenderer,
  Portal,
  Scrollable
} from 'cs2/ui';
import { memo, type ReactElement, type ReactNode, useContext, useMemo, useState } from 'react';
import type { Screenshot } from '../../common';
import { PreloadImages } from '../../components/preload-images';
import apertureDuotoneLightSrc from '../../icons/fontawesome/aperture-duotone-light.svg';
import apertureSharpSolidSrc from '../../icons/fontawesome/aperture-sharp-solid.svg';
import penLineDuotoneLightSrc from '../../icons/fontawesome/pen-line-duotone-light.svg';
import penLineSolidSrc from '../../icons/fontawesome/pen-line-solid.svg';
import paradoxModsSolidSrc from '../../icons/paradox/paradox-mods-solid.svg';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import {
  TransitionContext,
  TransitionState
} from '../../vanilla-modules/game-ui/common/animations/transition-context';
import { TransitionGroupCoordinator } from '../../vanilla-modules/game-ui/common/animations/transition-group-coordinator';
import { Panel } from '../../vanilla-modules/game-ui/common/panel/panel';
import { PanelBackdrop } from '../../vanilla-modules/game-ui/common/panel/panel-backdrop';
import { PanelTitleBar } from '../../vanilla-modules/game-ui/common/panel/panel-title-bar';
import { iceflakePanelTheme } from '../../vanilla-modules/game-ui/common/panel/themes/iceflake-panel';
import { Tab, TabBar } from '../../vanilla-modules/game-ui/common/tabs/tabs';
import { type DetailsTabState, selectScreenshotDetails } from './screenshot-details';
import { selectLocalizedName } from './select-localized-name';
import * as styles from './screenshot-details-window.module.scss';

const vanillaParadoxModsSrc = 'Media/Glyphs/ParadoxMods.svg';

/**
 * Every icon the window's empty states can show, preloaded while it is open rather than with the
 * controls, so they cost nothing until the window is used.
 * Each tab still draws its icon blank the first time it shows before the icon has landed.
 */
const preloadedIcons: readonly string[] = [
  penLineDuotoneLightSrc,
  apertureDuotoneLightSrc,
  vanillaParadoxModsSrc
];

/**
 * The window holding everything known about a screenshot, a modal built from the same parts as the
 * game's own large windows: a title band, a tab bar under it, and a body over a dimmed backdrop.
 *
 * It stays mounted while closed, so the transition group it holds can play the game's panel
 * transition both ways, keeping a closing window on screen until its exit has played.
 */
export const ScreenshotDetailsWindow = memo(
  ({
    screenshot,
    openTab,
    onClose
  }: Readonly<{
    screenshot: Screenshot;
    /**
     * The tab the window opens on, `undefined` while it is closed.
     */
    openTab: DetailsTabId | undefined;
    onClose: () => void;
  }>): ReactElement => (
    <Portal>
      {/*
        The window's own transition group. The panel registers with it rather than with the main
        menu's, which would file the panel under the menu screen's key and drop the menu screen
        along with the closing window.
      */}
      <TransitionGroupCoordinator>
        {openTab != undefined && (
          <DetailsModal
            key='details'
            screenshot={screenshot}
            initialTab={openTab}
            onClose={onClose}
          />
        )}
      </TransitionGroupCoordinator>
    </Portal>
  )
);

function DetailsModal({
  screenshot,
  initialTab,
  onClose
}: Readonly<{
  screenshot: Screenshot;
  initialTab: DetailsTabId;
  onClose: () => void;
}>): ReactElement {
  const translate = useTranslate();

  const gameLocale = bindings.useLocale();

  const modSettings = bindings.useModSettings();

  const details = selectScreenshotDetails(screenshot);

  // The same form of the name the controls show, or the native one when that form is missing.
  const city = selectLocalizedName(modSettings.namesTranslationMode, gameLocale, {
    value: screenshot.cityName,
    latinized: screenshot.cityNameLatinized,
    translated: screenshot.cityNameTranslated,
    locale: screenshot.cityNameLocale
  });

  // Not kept across openings: the window reopens on the tab it is opened on.
  const [selectedTab, setSelectedTab] = useState(initialTab);

  // Switch Tab is handled here rather than by the vanilla tab bar, which waits for the focus the
  // way Back would. It wraps around at either end.
  const actions = useMemo(
    () => ({
      'Back': onClose,
      'Switch Tab': (direction: number) => {
        if (direction == 0) {
          return;
        }

        // From the state rather than the render: the input stack keeps this handler until its
        // next rebuild, which a second press can beat.
        setSelectedTab(currentTab => {
          const index = detailsTabs.findIndex(tab => tab.id == currentTab);
          const count = detailsTabs.length;

          return detailsTabs[(index + (direction < 0 ? count - 1 : 1)) % count]?.id ?? currentTab;
        });

        bindings.playSound(direction < 0 ? 'select-previous-item' : 'select-next-item');
      }
    }),
    [onClose]
  );

  // The backdrop fades out alongside the panel's exit, which the transition group drives.
  const isExiting = useContext(TransitionContext).state == TransitionState.exit;

  return (
    // The slideshow controls sit outside the focus path Back travels along, so a consumer waiting
    // for focus would never hear it: this one listens whatever holds the focus.
    <InputActionConsumer actions={actions} ignoreFocusState={true}>
      <PanelBackdrop
        className={classNames(styles.backdrop, isExiting && styles.backdropExiting)}
        onMouseDown={onClose}>
        <Panel
          className={styles.window}
          theme={iceflakePanelTheme}
          header={
            <>
              <PanelTitleBar>{city.name ?? screenshot.cityName}</PanelTitleBar>

              <TabBar className={styles.tabBar}>
                {detailsTabs.map(tab => (
                  <Tab
                    key={tab.id}
                    id={tab.id}
                    selectedId={selectedTab}
                    className={styles.tab}
                    onSelect={setSelectedTab}>
                    <Icon
                      src={tab.iconSrc}
                      tinted={true}
                      className={classNames(styles.tabIcon, tab.iconClassName)}
                    />
                    <span className={styles.tabLabel}>{translate(tab.labelId)}</span>
                  </Tab>
                ))}
              </TabBar>
            </>
          }
          onClose={onClose}>
          <PreloadImages srcs={preloadedIcons} />

          {/* Keyed on the screenshot and the tab, so each starts scrolled to its top. */}
          <Scrollable key={`${screenshot.id}-${selectedTab}`} className={styles.windowContent}>
            {selectedTab == 'description' && <DescriptionTab state={details.description} />}

            {selectedTab == 'photoModeSettings' && (
              <EmptyState iconSrc={apertureDuotoneLightSrc}>
                {translate('HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Coming]')}
              </EmptyState>
            )}

            {selectedTab == 'playset' && (
              <EmptyState iconSrc={vanillaParadoxModsSrc}>
                {translate('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Coming]')}
              </EmptyState>
            )}
          </Scrollable>
        </Panel>
      </PanelBackdrop>
    </InputActionConsumer>
  );
}

function DescriptionTab({ state }: Readonly<{ state: DetailsTabState }>): ReactElement {
  const translate = useTranslate();

  // Built here rather than at module scope, so a missing game export costs this tab rather than the
  // whole mod UI.
  const renderer = useMemo(() => new MarkdownRenderer(), []);

  switch (state.kind) {
    case 'content': {
      return (
        <FormattedParagraphs
          className={styles.windowParagraphs}
          renderer={renderer}
          theme={descriptionTheme}>
          {state.text}
        </FormattedParagraphs>
      );
    }
    case 'notShared': {
      return (
        <EmptyState iconSrc={penLineDuotoneLightSrc}>
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.DESCRIPTION[Not Shared]')}
        </EmptyState>
      );
    }
    case 'predatesFeature': {
      return (
        <EmptyState iconSrc={penLineDuotoneLightSrc}>
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.DESCRIPTION[Predates Feature]')}
        </EmptyState>
      );
    }
    default: {
      // oxlint-disable-next-line typescript/only-throw-error
      throw state satisfies never;
    }
  }
}

/**
 * A tab with nothing to show, laid out like the game's own empty panels under the tab's icon.
 */
function EmptyState({
  iconSrc,
  children
}: Readonly<{ iconSrc: string; children: ReactNode }>): ReactElement {
  return (
    <div className={styles.emptyState}>
      <Icon src={iconSrc} tinted={true} className={styles.emptyStateIcon} />
      <p className={styles.emptyStateText}>{children}</p>
    </div>
  );
}

export type DetailsTabId = 'description' | 'photoModeSettings' | 'playset';

/**
 * The window's tabs, in display order.
 * The photo mode settings and the playset show a placeholder until their tabs ship.
 */
const detailsTabs: ReadonlyArray<{
  readonly id: DetailsTabId;
  readonly labelId: string;
  readonly iconSrc: string;
  readonly iconClassName?: string;
}> = [
  {
    id: 'description',
    labelId: 'HallOfFame.UI.Menu.ScreenshotDetails.TAB[Description]',
    iconSrc: penLineSolidSrc
  },
  {
    id: 'photoModeSettings',
    labelId: 'HallOfFame.UI.Menu.ScreenshotDetails.TAB[Photo Mode Settings]',
    iconSrc: apertureSharpSolidSrc,
    iconClassName: styles.tabIconDisc
  },
  {
    id: 'playset',
    labelId: 'HallOfFame.UI.Menu.ScreenshotDetails.TAB[Playset]',
    iconSrc: paradoxModsSolidSrc,
    iconClassName: styles.tabIconHexagon
  }
];

/**
 * The tabs' icons, for the controls to preload: unlike the empty states' icons, they show on the
 * frame the window opens.
 */
// oxlint-disable-next-line react/only-export-components - no Fast Refresh in a Cohtml bundle
export const detailsTabsPreloadedIcons: readonly string[] = detailsTabs.map(tab => tab.iconSrc);

// Headings keep the game's own styles; paragraphs get room between them.
const descriptionTheme: Partial<FormattedTextTheme> = {
  // oxlint-disable-next-line id-length - the vanilla theme's own key for a plain paragraph
  p: styles.windowText
};
