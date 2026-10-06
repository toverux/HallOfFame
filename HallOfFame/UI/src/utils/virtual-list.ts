import { type MutableRefObject, useEffect, useState } from 'react';
import { getClassesModule, selector } from './vanilla-modules';

const coScrollableClasses = getClassesModule('game-ui/common/scrolling/scrollable.module.scss', [
  'content'
]);

/**
 * The element that scrolls in the vanilla `Scrollable` a virtual list renders into, for the list's
 * scroll container, found from a node inside it.
 * A `Scrollable` built by vanilla never hands its element out as a ref, so the list climbs out of a
 * node of its own to the `Scrollable`'s inner content element.
 * The outer one carries the scrollbar tracks and never moves, so a scroll position read from it is
 * always zero.
 */
export function findScrollableContent(node: HTMLElement | null): HTMLElement | null {
  return node?.closest(selector(coScrollableClasses.content)) ?? null;
}

/**
 * Measures how tall one row is, which the virtual list needs in pixels to place rows it never
 * renders, holding `estimatedHeightPx` until then.
 *
 * Read off a rendered row, the first matching `rowSelector`, as the row's `rem` lengths scale with
 * the viewport and the player's font-size setting, and the engine hands no resolved length back.
 *
 * Cohtml lays out on its own frame rather than on demand, so a row measures zero for as long as the
 * engine has not reached it, and no read taken while React is still committing can see it. The
 * measurement therefore retries on animation frames until a row answers with a height, leaving the
 * opening frames on the estimate.
 */
export function useMeasuredRowHeight(
  scrollable: MutableRefObject<HTMLElement | null>,
  rowSelector: string,
  estimatedHeightPx: number
): number {
  const [rowHeight, setRowHeight] = useState(estimatedHeightPx);

  useEffect(() => {
    let frame = 0;

    function measure(): void {
      const row = scrollable.current?.querySelector(rowSelector);

      if (row instanceof HTMLElement && row.offsetHeight > 0) {
        setRowHeight(row.offsetHeight);
      } else {
        frame = requestAnimationFrame(measure);
      }
    }

    measure();

    return () => cancelAnimationFrame(frame);
  }, [scrollable, rowSelector]);

  return rowHeight;
}
