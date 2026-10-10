import type { BalloonAlignment, BalloonDirection } from 'cs2/ui';
import { type ReactElement, type ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import {
  AnchoredBalloon,
  type BalloonUiTarget,
  vanillaTooltipTheme
} from '../vanilla-modules/game-ui/common/balloon/anchored-balloon';
import { DOMNodeModifier } from '../vanilla-modules/game-ui/common/dom-node/dom-node';

export interface TooltipProps {
  readonly tooltip: ReactNode;
  readonly direction?: BalloonDirection | undefined;
  readonly alignment?: BalloonAlignment | undefined;
  readonly disabled?: boolean | undefined;
  readonly forceVisible?: boolean | undefined;
  readonly delayTime?: number | undefined;
  /**
   * Applied to the balloon, not to the anchor.
   */
  readonly className?: string | undefined;
  readonly children: ReactElement;
}

/**
 * A tooltip that opens on the side it is asked to, which the vanilla `Tooltip` no longer does: it
 * hands the balloon `direction` and `alignment` as flat props, and the balloon reads them off its
 * `balloonUiTarget` instead, so every tooltip in the game opens `up` whatever it asked for.
 * This drives the same balloon through the channel it actually reads, so it keeps working either
 * way should the game reconnect the props.
 *
 * It is the mod's only tooltip, placement or not, so that there is one to reason about rather than
 * two whose props differ in ways nothing warns about. What it gives up in exchange is showing on
 * gamepad focus, which the vanilla one drives off an input observable the bundle does not export.
 *
 * The children are wrapped exactly as a vanilla `Tooltip` wraps them, in a single
 * {@link DOMNodeModifier}, so a mod component standing in for a vanilla leaf claims one handle here
 * and not two.
 */
export function Tooltip({
  tooltip,
  direction,
  alignment,
  disabled = false,
  forceVisible = false,
  delayTime,
  className,
  children
}: Readonly<TooltipProps>): ReactElement {
  // Hidden by a wheel notch, or kept from opening by one, until the next mouse movement: a scroll
  // carries the anchor away under the balloon, and the engine then re-runs its hit test and fires
  // `mouseover` on whatever the scroll brought under the still cursor, with no `mousemove`.
  const [state, setState] = useState(hidden);

  const anchorElRef = useRef<HTMLElement | null>(null);

  // Each listener returns the state it got where nothing changes, so React skips the update: the
  // mouse moves far more often than the hold is released.
  const show = useCallback(() => {
    const opened = isWheelHeld ? heldClosed : shown;

    setState(current => (current.isHovered || current.isHeldClosed ? current : opened));
  }, []);

  // A press hides the tooltip until the next `mouseover`, a child's of the anchor included: it is
  // in the way of whatever the press just opened.
  const hide = useCallback(
    () => setState(current => (current.isHovered || current.isHeldClosed ? hidden : current)),
    []
  );

  // Only a shown tooltip is held: one a press hid stays hidden through the move releasing the hold.
  const holdClosed = useCallback(
    () => setState(current => (current.isHovered ? heldClosed : current)),
    []
  );

  const release = useCallback(
    () => setState(current => (current.isHeldClosed ? shown : current)),
    []
  );

  // Native listeners rather than React props, because the anchor is whatever element the children
  // happen to render, which this component never gets to hand props to.
  const setAnchorEl = useCallback(
    (element: HTMLElement | null): void => {
      if (anchorElRef.current == element) {
        return;
      }

      anchorElRef.current?.removeEventListener('mouseover', show);
      anchorElRef.current?.removeEventListener('mouseleave', hide);
      anchorElRef.current?.removeEventListener('mousedown', hide);
      anchorElRef.current?.removeEventListener('wheel', holdClosed);
      anchorElRef.current?.removeEventListener('mousemove', release);

      element?.addEventListener('mouseover', show);
      element?.addEventListener('mouseleave', hide);
      element?.addEventListener('mousedown', hide);
      element?.addEventListener('wheel', holdClosed);
      element?.addEventListener('mousemove', release);

      anchorElRef.current = element;
    },
    [show, hide, holdClosed, release]
  );

  // The balloon redoes its placement whenever this changes identity, so it cannot be a fresh object
  // on every render.
  const balloonUiTarget = useMemo<BalloonUiTarget>(
    () => ({ direction, alignment }),
    [direction, alignment]
  );

  return (
    <AnchoredBalloon
      // An absent tooltip is gated here, as the vanilla one does it: the balloon treats a null
      // content as content and draws itself empty, and `translate` returns null for a key the
      // active locale lacks.
      visible={(forceVisible || state.isHovered) && !disabled && Boolean(tooltip)}
      content={tooltip}
      balloonUiTarget={balloonUiTarget}
      theme={vanillaTooltipTheme}
      delayTime={state.isHeldClosed ? 0 : delayTime}
      className={className}
      anchorElRef={anchorElRef}>
      <DOMNodeModifier ref={setAnchorEl}>{children}</DOMNodeModifier>
    </AnchoredBalloon>
  );
}

interface TooltipState {
  readonly isHovered: boolean;
  readonly isHeldClosed: boolean;
}

const hidden: TooltipState = { isHovered: false, isHeldClosed: false };

const shown: TooltipState = { isHovered: true, isHeldClosed: false };

const heldClosed: TooltipState = { isHovered: false, isHeldClosed: true };

// One hold for every tooltip: the notch lands on the anchor under the cursor, and the one the
// scroll then brings under it never saw the notch, so its `mouseover` has to be held too.
// A notch over the game world holds them as well, until the first move; holding only on an anchor
// would miss a notch between two rows.
// Each tooltip keeps its own hold beside this one, so a move re-shows only the one it is over.
let isWheelHeld = false;

// Never removed: a UI reload resets the script context.
// Capture phase, so a scrollable stopping the notch's propagation cannot hide it.
document.addEventListener(
  'wheel',
  () => {
    isWheelHeld = true;
  },
  true
);

document.addEventListener(
  'mousemove',
  () => {
    isWheelHeld = false;
  },
  true
);
