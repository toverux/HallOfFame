import {
  type MutableRefObject,
  type ReactNode,
  type RefCallback,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import {
  useUniformSizeProvider,
  useVirtualList
} from '../vanilla-modules/game-ui/common/scrolling/virtual-list/virtual-list';
import { getClassesModule, selector } from './vanilla-modules';

const coScrollableClasses = getClassesModule('game-ui/common/scrolling/scrollable.module.scss', [
  'content'
]);

export interface UniformVirtualListOptions {
  readonly count: number;

  /**
   * Rows kept rendered past each edge of the viewport.
   */
  readonly overscan: number;

  /**
   * Matches every row, the first one rendered being measured, see {@link useMeasuredRowHeight}.
   */
  readonly rowSelector: string;

  readonly estimatedRowHeightPx: number;

  readonly className?: string | undefined;

  /**
   * Keep it stable, memoized on what it reads: the list rebuilds its rows whenever it changes, and
   * it re-renders on every scroll frame.
   */
  readonly renderRow: (index: number) => ReactNode;
}

export interface UniformVirtualList {
  /**
   * For an empty node rendered beside the list, inside the vanilla `Scrollable` the list scrolls
   * in, which the list climbs out of to find its scroll container.
   */
  readonly anchorRef: RefCallback<HTMLElement>;

  /**
   * The list's scroll container once the anchor is mounted.
   */
  readonly scrollableRef: MutableRefObject<HTMLElement | null>;

  readonly list: ReactNode;
}

/**
 * The game's virtual list over rows of one height, only those in view built, rendered into a
 * vanilla `Scrollable` around it rather than into one of its own.
 */
export function useUniformVirtualList({
  count,
  overscan,
  rowSelector,
  estimatedRowHeightPx,
  className,
  renderRow
}: UniformVirtualListOptions): UniformVirtualList {
  const scrollableRef = useRef<HTMLElement | null>(null);

  const anchorRef = useCallback((node: HTMLElement | null) => {
    scrollableRef.current = findScrollableContent(node);
  }, []);

  const rowHeight = useMeasuredRowHeight(scrollableRef, rowSelector, estimatedRowHeightPx);

  const sizeProvider = useUniformSizeProvider(rowHeight, count, overscan);

  const { list } = useVirtualList(scrollableRef, sizeProvider, 'vertical', className, renderRow);

  return { anchorRef, scrollableRef, list };
}

/**
 * The element that scrolls in the vanilla `Scrollable` a virtual list renders into, for the list's
 * scroll container, found from a node inside it.
 * A `Scrollable` built by vanilla never hands its element out as a ref, so the list climbs out of a
 * node of its own to the `Scrollable`'s inner content element.
 * The outer one carries the scrollbar tracks and never moves, so a scroll position read from it is
 * always zero.
 */
function findScrollableContent(node: HTMLElement | null): HTMLElement | null {
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
function useMeasuredRowHeight(
  scrollable: MutableRefObject<HTMLElement | null>,
  rowSelector: string,
  estimatedHeightPx: number
): number {
  const [rowHeight, setRowHeight] = useState(estimatedHeightPx);

  useEffect(() => {
    let frame = 0;

    function measure(): void {
      const height = measuredHeight(scrollable.current?.querySelector(rowSelector));

      if (height > 0) {
        setRowHeight(height);
      } else {
        frame = requestAnimationFrame(measure);
      }
    }

    measure();

    return () => cancelAnimationFrame(frame);
  }, [scrollable, rowSelector]);

  return rowHeight;
}

/**
 * A row's height as laid out, zero where there is no row or the engine has not laid it out yet.
 * Unrounded: `offsetHeight` rounds it, and a fraction lost per row adds up to a list a few pixels
 * shorter than its rows, which overflows and shows a scrollbar.
 * Divided by the scale an ancestor's transform gives the rect but not the layout width,
 * so a row read during a panel's opening transition does not keep its scaled height.
 * The ratio is the width's: it undoes a uniform scale and nothing else.
 */
function measuredHeight(row: Element | null | undefined): number {
  if (!(row instanceof HTMLElement)) {
    return 0;
  }

  const rect = row.getBoundingClientRect();
  const scale = row.offsetWidth > 0 ? rect.width / row.offsetWidth : 1;

  return rect.height / scale;
}
