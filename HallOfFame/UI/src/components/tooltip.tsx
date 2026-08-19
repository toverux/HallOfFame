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
  const [isHovered, setIsHovered] = useState(false);

  const anchorElRef = useRef<HTMLElement | null>(null);

  const show = useCallback(() => setIsHovered(true), []);

  const hide = useCallback(() => setIsHovered(false), []);

  // Native listeners rather than React props, because the anchor is whatever element the children
  // happen to render, which this component never gets to hand props to.
  // A pointer press hides the tooltip too: it is in the way of whatever the press just opened.
  const setAnchorEl = useCallback(
    (element: HTMLElement | null): void => {
      if (anchorElRef.current == element) {
        return;
      }

      anchorElRef.current?.removeEventListener('mouseover', show);
      anchorElRef.current?.removeEventListener('mouseleave', hide);
      anchorElRef.current?.removeEventListener('mousedown', hide);

      element?.addEventListener('mouseover', show);
      element?.addEventListener('mouseleave', hide);
      element?.addEventListener('mousedown', hide);

      anchorElRef.current = element;
    },
    [show, hide]
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
      visible={(forceVisible || isHovered) && !disabled && Boolean(tooltip)}
      content={tooltip}
      balloonUiTarget={balloonUiTarget}
      theme={vanillaTooltipTheme}
      delayTime={delayTime}
      className={className}
      anchorElRef={anchorElRef}>
      <DOMNodeModifier ref={setAnchorEl}>{children}</DOMNodeModifier>
    </AnchoredBalloon>
  );
}
