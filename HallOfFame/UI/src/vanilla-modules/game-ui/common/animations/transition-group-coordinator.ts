import { createElement, type FC, Fragment, type ReactNode } from 'react';
import { getModuleExport } from '../../../../utils';

export interface TransitionGroupCoordinatorProps {
  /**
   * Leaves the children present at mount settled rather than playing their enter transition.
   */
  readonly skipInitial?: boolean;

  readonly children?: ReactNode;
}

/**
 * Plays the vanilla transitions of its keyed children: a child coming in plays its enter
 * transition, and a child going away stays rendered until its exit transition has played.
 *
 * Each keyed child gets a transition context of its own, which the transitions inside it, a
 * `Panel`'s included, register with.
 */
export const TransitionGroupCoordinator = getModuleExport<FC<TransitionGroupCoordinatorProps>>(
  'game-ui/common/animations/transition-group-coordinator.tsx',
  'TransitionGroupCoordinator',
  (value): value is FC<TransitionGroupCoordinatorProps> => typeof value == 'function',
  // Children come and go at once: only reached when the vanilla module is gone and already
  // reported.
  ({ children }) => createElement(Fragment, null, children)
);
