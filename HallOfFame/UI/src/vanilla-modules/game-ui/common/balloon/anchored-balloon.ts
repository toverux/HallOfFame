import type { BalloonAlignment, BalloonDirection, BalloonTheme } from 'cs2/ui';
import type { FC, ReactElement, ReactNode, RefObject } from 'react';
import { getClassesModule, getModuleExport } from '../../../../utils';

/**
 * The look a vanilla `Tooltip` gives its balloon, which a balloon rendered directly has to ask for.
 */
export const vanillaTooltipTheme = getClassesModule('game-ui/common/tooltip/tooltip.module.scss', [
  'balloon',
  'enter',
  'enterActive',
  'exitActive',
  'container',
  'arrow',
  'content'
]);

/**
 * Where the balloon sits against its anchor, and how it lines up along that edge.
 *
 * The name is the game's: this is the descriptor a tutorial hands its balloon, and it is the only
 * channel {@link AnchoredBalloon} reads placement from.
 * Absent, it falls back to `up` and `center`.
 */
export interface BalloonUiTarget {
  readonly direction?: BalloonDirection | undefined;
  readonly alignment?: BalloonAlignment | undefined;
}

/**
 * Inferred from `game-ui/common/balloon/anchored-balloon.tsx`, and narrowed to the props the mod
 * uses.
 */
export interface AnchoredBalloonProps {
  readonly visible: boolean;

  readonly content: ReactNode;

  readonly balloonUiTarget?: BalloonUiTarget | undefined;

  readonly theme?: Partial<BalloonTheme> | undefined;

  readonly delayTime?: number | undefined;

  readonly className?: string | undefined;

  /**
   * The element the balloon measures itself against.
   * Supplying it also stops the balloon from wrapping the children in a `DOMNodeModifier` of its
   * own, which is what lets the caller own that wrapper and the anchor handle with it.
   */
  readonly anchorElRef?: RefObject<HTMLElement | null> | undefined;

  readonly children: ReactElement;
}

/**
 * The balloon behind every vanilla tooltip: it measures the anchor, picks a side, and flips to the
 * opposite one when the chosen side would put it off-screen.
 *
 * Reached directly rather than through `Tooltip`, the component that would normally own it:
 * `Tooltip` still passes `direction` and `alignment` as flat props, which this no longer reads, so
 * every tooltip placed through it lands `up`. Only {@link BalloonUiTarget} gets through.
 */
export const AnchoredBalloon = getModuleExport<FC<AnchoredBalloonProps>>(
  'game-ui/common/balloon/anchored-balloon.tsx',
  'AnchoredBalloon',
  // A memoized component is an object, not a function, so the guard can only check that this is
  // something React could render.
  (value): value is FC<AnchoredBalloonProps> =>
    typeof value == 'function' || (value != null && typeof value == 'object'),
  props => props.children
);
