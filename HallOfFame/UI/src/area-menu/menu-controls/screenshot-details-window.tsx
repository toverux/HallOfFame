import classNames from 'classnames';
import { InputActionConsumer } from 'cs2/input';
import {
  FormattedParagraphs,
  type FormattedTextTheme,
  MarkdownRenderer,
  Portal,
  Scrollable
} from 'cs2/ui';
import { memo, type ReactElement, useContext, useMemo } from 'react';
import type { Screenshot } from '../../common';
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

/**
 * The window holding everything known about a screenshot, a modal built from the same parts as the
 * game's own large windows: a title band, a tab bar under it, and a body over a dimmed backdrop.
 *
 * It stays mounted while closed, so the transition group it holds can play the game's panel
 * transition both ways, keeping a closing window on screen until its exit has played.
 *
 * It follows the screenshot it is handed, so navigating while it is open re-targets it rather than
 * closing it.
 */
export const ScreenshotDetailsWindow = memo(
  ({
    screenshot,
    isOpen,
    onClose
  }: Readonly<{
    screenshot: Screenshot;
    isOpen: boolean;
    onClose: () => void;
  }>): ReactElement => (
    <Portal>
      {/*
        The window's own transition group. The panel registers with it rather than with the main
        menu's, which would file the panel under the menu screen's key and drop the menu screen
        along with the closing window.
      */}
      <TransitionGroupCoordinator>
        {isOpen && <DetailsModal key='details' screenshot={screenshot} onClose={onClose} />}
      </TransitionGroupCoordinator>
    </Portal>
  )
);

function DetailsModal({
  screenshot,
  onClose
}: Readonly<{
  screenshot: Screenshot;
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

  const backActions = useMemo(() => ({ Back: onClose }), [onClose]);

  // The backdrop fades out alongside the panel's exit, which the transition group drives.
  const isExiting = useContext(TransitionContext).state == TransitionState.exit;

  return (
    // The slideshow controls sit outside the focus path Back travels along, so a consumer waiting
    // for focus would never hear it: this one listens whatever holds the focus.
    <InputActionConsumer actions={backActions} ignoreFocusState={true}>
      <PanelBackdrop
        className={classNames(styles.backdrop, isExiting && styles.backdropExiting)}
        onMouseDown={onClose}>
        <Panel
          className={styles.window}
          theme={iceflakePanelTheme}
          header={
            <>
              <PanelTitleBar>{city.name ?? screenshot.cityName}</PanelTitleBar>

              <TabBar>
                <Tab id='description' selectedId='description' onSelect={keepSelectedTab}>
                  {translate(
                    'HallOfFame.UI.Menu.ScreenshotDetails.TAB[Description]',
                    'Description'
                  )}
                </Tab>
              </TabBar>
            </>
          }
          onClose={onClose}>
          {/* Keyed on the screenshot, so the next one starts scrolled to its top. */}
          <Scrollable key={screenshot.id} className={styles.windowContent}>
            <DescriptionTab state={details.description} />
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
        <p className={styles.windowEmpty}>
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.DESCRIPTION[Not Shared]')}
        </p>
      );
    }
    case 'predatesFeature': {
      return (
        <p className={styles.windowEmpty}>
          {translate('HallOfFame.UI.Menu.ScreenshotDetails.DESCRIPTION[Predates Feature]')}
        </p>
      );
    }
    default: {
      // oxlint-disable-next-line typescript/only-throw-error
      throw state satisfies never;
    }
  }
}

function keepSelectedTab(): void {
  // The Description tab is the only one, so selecting it changes nothing.
}

// Headings keep the game's own styles; paragraphs get room between them.
const descriptionTheme: Partial<FormattedTextTheme> = {
  // oxlint-disable-next-line id-length - the vanilla theme's own key for a plain paragraph
  p: styles.windowText
};
