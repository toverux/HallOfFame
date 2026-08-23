import type { MutableRefObject, ReactNode } from 'react';
import { getModuleExport } from '../../../../../utils';

/**
 * The slice of a list to render: which items the viewport covers, and where they sit.
 */
export interface VirtualListRange {
  readonly startIndex: number;

  readonly endIndex: number;

  /**
   * Distance in pixels from the list's start to `startIndex`, which the list lays out as leading
   * padding so the rendered rows sit where the absent ones would have put them.
   */
  readonly offset: number;
}

/**
 * Tells a virtual list how large its items are, which is what lets it map a scroll position onto a
 * range of them without any of them existing.
 *
 * Inferred from `game-ui/common/scrolling/virtual-list/virtual-list-size-provider.ts`, which also
 * offers a per-item variant for lists whose rows differ in size.
 */
export interface VirtualListSizeProvider {
  readonly getRenderedRange: (scrollPos: number, viewportSize: number) => VirtualListRange;

  readonly getTotalSize: () => number;
}

/**
 * Builds a size provider for a list whose every row is `itemSize` pixels tall, keeping `overscan`
 * extra rows rendered on each side of the viewport.
 */
export type UseUniformSizeProvider = (
  itemSize: number,
  itemCount: number,
  overscan: number
) => VirtualListSizeProvider;

/**
 * Renders a scroll position as a windowed list, returning the element to place inside the scroll
 * container `scrollable` points at.
 *
 * This is the hook behind vanilla's `VirtualList` component, and the reason the component itself is
 * not what the mod uses: `VirtualList` brings its own `Scrollable`, whereas a dropdown menu already
 * scrolls inside the one vanilla's `Dropdown` wraps its content in. The hook takes that container
 * instead of making another.
 *
 * It reads the container's scroll position on an animation frame rather than from a scroll event,
 * so nothing needs to be wired to the returned `onScroll` for it to follow the scrollbar.
 */
// oxlint-disable-next-line max-params - the vanilla hook's own positional signature
export type UseVirtualList = (
  scrollable: MutableRefObject<HTMLElement | null>,
  sizeProvider: VirtualListSizeProvider,
  direction: 'vertical' | 'horizontal',
  className: string | undefined,
  renderItem: (index: number, offsetInWindow: number) => ReactNode
) => VirtualList;

export interface VirtualList {
  readonly list: ReactNode;
  readonly onScroll: () => void;
}

export const useUniformSizeProvider = getModuleExport<UseUniformSizeProvider>(
  'game-ui/common/scrolling/virtual-list/virtual-list-size-provider.ts',
  'useUniformSizeProvider',
  (value): value is UseUniformSizeProvider => typeof value == 'function',
  // Inert fallback: only reached when the vanilla module is gone and already reported.
  () => ({
    getRenderedRange: () => ({ startIndex: 0, endIndex: 0, offset: 0 }),
    getTotalSize: () => 0
  })
);

export const useVirtualList = getModuleExport<UseVirtualList>(
  'game-ui/common/scrolling/virtual-list/virtual-list.tsx',
  'useVirtualList',
  (value): value is UseVirtualList => typeof value == 'function',
  // Inert fallback, as above.
  () => ({
    list: null,
    onScroll: () => {
      // No-op fallback: there is no scroll position to track without the vanilla hook.
    }
  })
);
