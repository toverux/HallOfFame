import classNames from 'classnames';
import { FocusDisabled } from 'cs2/input';
import { Button } from 'cs2/ui';
import { type ReactElement, useState } from 'react';
import { Tooltip } from '../../components/tooltip';
import logoSrc from '../../icons/stats-notification.svg';
import { getClassesModule, useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { vanillaTutorialBalloonTheme } from '../../vanilla-modules/game-ui/common/balloon/anchored-balloon';
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

/**
 * Each step's content, the welcome step alone carrying the mod's logo.
 */
const stepTexts: Readonly<
  Record<
    ShownMenuTourStep,
    { readonly icon?: string; readonly title: string; readonly message: string }
  >
> = {
  navigation: {
    icon: logoSrc,
    title: 'HallOfFame.UI.Menu.MenuTour.TITLE[Navigation]',
    message: 'HallOfFame.UI.Menu.MenuTour.MESSAGE[Navigation]'
  },
  menuVisibility: {
    title: 'HallOfFame.UI.Menu.MenuTour.TITLE[Menu Visibility]',
    message: 'HallOfFame.UI.Menu.MenuTour.MESSAGE[Menu Visibility]'
  },
  like: {
    title: 'HallOfFame.UI.Menu.MenuTour.TITLE[Like]',
    message: 'HallOfFame.UI.Menu.MenuTour.MESSAGE[Like]'
  },
  dashboard: {
    title: 'HallOfFame.UI.Menu.MenuTour.TITLE[Dashboard]',
    message: 'HallOfFame.UI.Menu.MenuTour.MESSAGE[Dashboard]'
  }
};

/**
 * Holds the tour's balloon open over the control it wraps while the tour is on that control's
 * step, rather than on hover.
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

  return (
    // Disabled rather than emptied when hidden, so the balloon keeps its content while it leaves,
    // and shown without the hover delay, there being no hover to wait for.
    <Tooltip
      direction='right'
      forceVisible={true}
      delayTime={0}
      theme={vanillaTutorialBalloonTheme}
      disabled={!isShown}
      tooltip={<MenuTourBalloon step={step} isLastStep={shownIsLastStep} />}>
      <span className={styles.anchor}>{children}</span>
    </Tooltip>
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

  const { icon, title, message } = stepTexts[step];

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
