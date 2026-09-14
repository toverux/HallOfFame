import { type Context, createContext } from 'react';
import { getModuleExport } from '../../../../utils';

/**
 * What a vanilla transition reads from the transition group around it: the state it is in, and
 * the callbacks registering it with that group.
 *
 * Inferred from `game-ui/common/animations/transition-context.tsx`.
 */
export interface TransitionContextValue {
  /**
   * The vanilla `TransitionState`: 0 is in, 1 is entering, 2 is exiting.
   */
  readonly state: number;

  readonly onMount: () => void;

  /**
   * Tells the group the transition is gone, and the group drops the child it registered under.
   */
  readonly onUnmount: () => void;
}

const inertContext: TransitionContextValue = {
  state: 0,
  onMount: () => {
    // No-op: there is no group to register with.
  },
  onUnmount: () => {
    // No-op, as above.
  }
};

/**
 * The context outside any transition group: a transition under it registers with nothing, and
 * starts in its settled state.
 */
export const defaultTransitionContext = getModuleExport<TransitionContextValue>(
  'game-ui/common/animations/transition-context.tsx',
  'defaultContext',
  (value): value is TransitionContextValue =>
    value != null && typeof value == 'object' && 'onUnmount' in value,
  inertContext
);

/**
 * The context vanilla transitions, the one inside every `Panel` included, register through.
 *
 * It reaches through a portal like any React context, so a panel rendered from inside a vanilla
 * transition group belongs to that group unless a provider cuts it off.
 */
export const TransitionContext = getModuleExport<Context<TransitionContextValue>>(
  'game-ui/common/animations/transition-context.tsx',
  'TransitionContext',
  (value): value is Context<TransitionContextValue> =>
    value != null && typeof value == 'object' && 'Provider' in value,
  createContext(inertContext)
);

export interface TransitionStates {
  readonly in: number;
  readonly enter: number;
  readonly exit: number;
}

/**
 * The values {@link TransitionContextValue.state} takes.
 */
export const TransitionState = getModuleExport<TransitionStates>(
  'game-ui/common/animations/transition-context.tsx',
  'TransitionState',
  (value): value is TransitionStates =>
    value != null && typeof value == 'object' && 'exit' in value,
  { in: 0, enter: 1, exit: 2 }
);
