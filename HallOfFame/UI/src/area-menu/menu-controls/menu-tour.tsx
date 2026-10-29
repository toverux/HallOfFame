import classNames from 'classnames';
import { FocusDisabled } from 'cs2/input';
import { Button } from 'cs2/ui';
import { type ReactElement, useState } from 'react';
import { Tooltip } from '../../components/tooltip';
import logoSrc from '../../icons/stats-notification.svg';
import { getClassesModule, useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { vanillaTutorialBalloonTheme } from '../../vanilla-modules/game-ui/common/balloon/anchored-balloon';
import { MenuControlsInputHint, MenuControlsInputKey } from './input-hint-tooltip';
import { useMenuControlsInputAction } from './use-menu-controls-input-action';
import * as styles from './menu-tour.module.scss';

const coTutorialLayoutStyles = getClassesModule(
  'game-ui/game/components/tutorials/tutorial-layout/tutorial-layout.module.scss',
  [
    'tutorialLayout',
    'columns',
    'iconColumn',
    'icon',
    'contentColumn',
    'content',
    'top',
    'title',
    'description'
  ]
);

const coTutorialActionButtonTheme = getClassesModule(
  'game-ui/game/components/tutorials/tutorial-layout/tutorial-action-button.module.scss',
  ['button', 'okButton']
);

type ShownMenuTourStep = Exclude<bindings.MenuTourStep, 'none'>;

interface MenuTourStepContent {
  readonly icon?: string;
  readonly title: string;
  readonly message: string;

  /**
   * The input actions doing what the step's control does, shown as rows of keys each followed by
   * the label of what they do.
   */
  readonly inputHints?: readonly MenuTourInputHint[];
}

interface MenuTourInputHint {
  readonly actions: readonly bindings.InputAction[];
  readonly label: string;
}

/**
 * Each step's content, the welcome step alone carrying the mod's logo.
 */
const stepContents: Readonly<Record<ShownMenuTourStep, MenuTourStepContent>> = {
  navigation: {
    icon: logoSrc,
    title: 'HallOfFame.UI.Menu.MenuTour.TITLE[Navigation]',
    message: 'HallOfFame.UI.Menu.MenuTour.MESSAGE[Navigation]',
    inputHints: [
      {
        actions: [bindings.previousScreenshotInputAction, bindings.nextScreenshotInputAction],
        label: 'HallOfFame.UI.Menu.MenuTour.INPUT_HINT[Navigation]'
      }
    ]
  },
  menuVisibility: {
    title: 'HallOfFame.UI.Menu.MenuTour.TITLE[Menu Visibility]',
    message: 'HallOfFame.UI.Menu.MenuTour.MESSAGE[Menu Visibility]',
    inputHints: [
      {
        actions: [bindings.toggleMenuInputAction],
        label: 'HallOfFame.UI.Menu.MenuTour.INPUT_HINT[Toggle Menu]'
      }
    ]
  },
  like: {
    title: 'HallOfFame.UI.Menu.MenuTour.TITLE[Like]',
    message: 'HallOfFame.UI.Menu.MenuTour.MESSAGE[Like]',
    inputHints: [
      {
        actions: [bindings.likeScreenshotInputAction],
        label: 'HallOfFame.UI.Menu.MenuTour.INPUT_HINT[Like]'
      }
    ]
  },
  dashboard: {
    title: 'HallOfFame.UI.Menu.MenuTour.TITLE[Dashboard]',
    message: 'HallOfFame.UI.Menu.MenuTour.MESSAGE[Dashboard]'
  }
};

/**
 * Holds the tour's balloon open over the control it wraps while the tour is on that control's
 * step, rather than on hover.
 * Using the control while the balloon shows moves the tour on, whether by a click on it or by a
 * press of one of the step's keys.
 * The control goes in a host element of its own, so a control lending its handle to a tooltip or
 * a dropdown of its own keeps it.
 */
export function MenuTourAnchor({
  step,
  children
}: Readonly<{
  step: ShownMenuTourStep;
  children: ReactElement;
}>): ReactElement {
  const tourStep = bindings.useMenuTourStep();

  const dashboardStatus = bindings.useDashboardState().status;

  // The balloon draws over everything, the dashboard opened mid-tour included, so it waits for it.
  const isShown = tourStep == step && dashboardStatus == 'closed';

  const isLastStep = bindings.useIsMenuTourLastStep();

  // Last read while shown: ending the tour clears the binding as the balloon starts leaving, which
  // would otherwise swap its buttons for the frames its exit lasts.
  const [shownIsLastStep, setShownIsLastStep] = useState(isLastStep);

  if (isShown && isLastStep != shownIsLastStep) {
    setShownIsLastStep(isLastStep);
  }

  function advance(): void {
    if (isShown) {
      bindings.nextMenuTourStep();
    }
  }

  return (
    <>
      {stepContents[step].inputHints?.flatMap(hint =>
        hint.actions.map(action => (
          <MenuTourInputActionListener key={action.id} action={action} onPerformed={advance} />
        ))
      )}

      {/* Disabled rather than emptied when hidden, so the balloon keeps its content while it
          leaves, and shown without the hover delay, there being no hover to wait for. */}
      <Tooltip
        direction='right'
        forceVisible={true}
        delayTime={0}
        theme={vanillaTutorialBalloonTheme}
        disabled={!isShown}
        tooltip={<MenuTourBalloon step={step} isLastStep={shownIsLastStep} />}>
        {/* On mouse down, as the slideshow's buttons act then, and a Next button disabled by the
            load it just started would not get the click. */}
        <span className={styles.anchor} onMouseDown={advance}>
          {children}
        </span>
      </Tooltip>
    </>
  );
}

/**
 * A step's content, laid out as a one-page vanilla tutorial step in the tutorial balloon its
 * tooltip draws.
 * Next moves the tour on and Close ends it, Close alone and primary on the last step.
 * The buttons stay out of focus navigation: the balloon sits in its anchor's focus controller,
 * which hosts the anchored control alone.
 */
function MenuTourBalloon({
  step,
  isLastStep
}: Readonly<{
  step: ShownMenuTourStep;
  isLastStep: boolean;
}>): ReactElement {
  const translate = useTranslate();

  const { icon, title, message, inputHints } = stepContents[step];

  return (
    <div className={classNames(coTutorialLayoutStyles.tutorialLayout, styles.balloon)}>
      <div className={coTutorialLayoutStyles.columns}>
        {icon != undefined && (
          <div className={coTutorialLayoutStyles.iconColumn}>
            <img src={icon} className={coTutorialLayoutStyles.icon} />
          </div>
        )}

        <div className={coTutorialLayoutStyles.contentColumn}>
          <div className={coTutorialLayoutStyles.content}>
            <div className={coTutorialLayoutStyles.top}>
              <div className={classNames(coTutorialLayoutStyles.title, styles.balloonTitle)}>
                {translate(title)}
              </div>
            </div>

            <div
              className={classNames(coTutorialLayoutStyles.description, styles.balloonDescription)}>
              {translate(message)}
            </div>

            {inputHints != undefined && (
              <div className={styles.balloonInputHints}>
                {inputHints.map(hint => (
                  <MenuTourBalloonInputHint key={hint.label} hint={hint} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.balloonFooter}>
        <FocusDisabled>
          <Button
            theme={coTutorialActionButtonTheme}
            className={classNames(coTutorialActionButtonTheme.okButton, styles.balloonButton, {
              [styles.balloonButtonSecondary]: !isLastStep
            })}
            onSelect={bindings.closeMenuTour}>
            {translate('HallOfFame.UI.Menu.MenuTour.ACTION[Close]')}
          </Button>

          {!isLastStep && (
            <Button
              theme={coTutorialActionButtonTheme}
              className={classNames(coTutorialActionButtonTheme.okButton, styles.balloonButton)}
              onSelect={bindings.nextMenuTourStep}>
              {translate('HallOfFame.UI.Menu.MenuTour.ACTION[Next]')}
            </Button>
          )}
        </FocusDisabled>
      </div>
    </div>
  );
}

/**
 * A row of the step's keys, followed by what they do.
 */
function MenuTourBalloonInputHint({
  hint
}: Readonly<{
  hint: MenuTourInputHint;
}>): ReactElement {
  const translate = useTranslate();

  return (
    <MenuControlsInputHint
      keys={hint.actions.map(action => (
        <MenuTourBalloonInputKey key={action.id} action={action} />
      ))}
      label={translate(hint.label)}
    />
  );
}

/**
 * The key an input action is bound to, read in a component of its own since a hint holds a
 * variable number of them.
 */
function MenuTourBalloonInputKey({
  action
}: Readonly<{
  action: bindings.InputAction;
}>): ReactElement {
  const binding = action.useInputBinding();

  return <MenuControlsInputKey binding={binding} isShort={true} />;
}

/**
 * Calls {@link onPerformed} each time the input action is performed (key down).
 */
function MenuTourInputActionListener({
  action,
  onPerformed
}: Readonly<{
  action: bindings.InputAction;
  onPerformed: () => void;
}>): null {
  useMenuControlsInputAction(action.useInputPhase(), onPerformed);

  return null;
}
