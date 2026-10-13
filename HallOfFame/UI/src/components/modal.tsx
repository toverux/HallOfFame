import classNames from 'classnames';
import { type InputActions, InputActionConsumer } from 'cs2/input';
import { Portal } from 'cs2/ui';
import { type ReactElement, type ReactNode, useContext } from 'react';
import {
  TransitionContext,
  TransitionState
} from '../vanilla-modules/game-ui/common/animations/transition-context';
import { TransitionGroupCoordinator } from '../vanilla-modules/game-ui/common/animations/transition-group-coordinator';
import { PanelBackdrop } from '../vanilla-modules/game-ui/common/panel/panel-backdrop';
import * as styles from './modal.module.scss';

/**
 * Hosts a modal window over the screen, which `children` renders while it is open:
 * a keyed element holding a {@link ModalBackdrop}, or nothing.
 * Stays mounted while the window is closed,
 * so the transition group it holds can play the game's panel transition both ways,
 * keeping a closing window on screen until its exit has played.
 */
export function ModalHost({ children }: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <Portal>
      {/*
        The window's own transition group. The panel registers with it rather than with the group
        of the screen hosting it, which would file the panel under that screen's key and drop the
        screen along with the closing window.
      */}
      <TransitionGroupCoordinator>{children}</TransitionGroupCoordinator>
    </Portal>
  );
}

/**
 * The game's backdrop under a modal panel, fading with the panel's transition,
 * closing the window on a press outside the panel, and on Back.
 *
 * @param actions The window's input actions, its Back among them.
 */
export function ModalBackdrop({
  actions,
  onClose,
  children
}: Readonly<{
  actions: InputActions;
  onClose: () => void;
  children: ReactNode;
}>): ReactElement {
  // The backdrop fades out alongside the panel's exit, which the transition group drives.
  const isExiting = useContext(TransitionContext).state == TransitionState.exit;

  return (
    // The screens hosting a modal keep their focus outside the path Back travels along, so a
    // consumer waiting for focus would never hear it: this one listens whatever holds the focus.
    <InputActionConsumer actions={actions} ignoreFocusState={true}>
      <PanelBackdrop
        className={classNames(styles.backdrop, isExiting && styles.backdropExiting)}
        onMouseDown={onClose}>
        {children}
      </PanelBackdrop>
    </InputActionConsumer>
  );
}
