import { trigger, useValue } from 'cs2/api';
import { lazyBindValue } from './lazy-value-binding';

const GROUP = 'hallOfFame.menuTour';

/**
 * Serialization of C# `HallOfFame.Services.MenuTourStep`: the control the main menu's tour points
 * at, `none` once the tour is over.
 */
export type MenuTourStep = 'none' | 'navigation' | 'menuVisibility' | 'like' | 'dashboard';

const step$ = lazyBindValue<MenuTourStep>(GROUP, 'step', 'none');

const isLastStep$ = lazyBindValue<boolean>(GROUP, 'isLastStep', false);

/**
 * Subscribes to the step of the main menu's one-time tour, which C# decides.
 */
export function useMenuTourStep(): MenuTourStep {
  return useValue(step$());
}

/**
 * Subscribes to whether the tour's step is its last, whose button closes it rather than moving on.
 */
export function useIsMenuTourLastStep(): boolean {
  return useValue(isLastStep$());
}

/**
 * Moves the tour on to its next step, or ends it from its last.
 */
export function nextMenuTourStep(): void {
  trigger(GROUP, 'next');
}

/**
 * Ends the tour for good.
 */
export function closeMenuTour(): void {
  trigger(GROUP, 'close');
}

/**
 * Tells C# the slideshow's more-actions menu opened, which ends the tour when its step was pointing
 * at that menu.
 */
export function reportMoreActionsOpened(): void {
  trigger(GROUP, 'moreActionsOpened');
}
