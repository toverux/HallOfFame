import { AutoNavigationScope } from 'cs2/input';
import { Scrollable } from 'cs2/ui';
import { type ReactElement, useCallback, useMemo } from 'react';
import type { CreatorStats, DashboardScreenshot } from '../../common';
import { useUniformVirtualList } from '../../utils';
import { DashboardCard } from './dashboard-card';
import { chunkRows } from './dashboard-collection';
import * as styles from './dashboard-grid.module.scss';

/**
 * The collection as rows of cards in the game's virtual list, only the rows in view built:
 * a collection runs to hundreds of screenshots, each card a remote thumbnail.
 * A row holds a fixed number of cards whatever the resolution,
 * the window and the cards being sized alike in `rem`.
 */
export function DashboardGrid({
  screenshots,
  stats
}: Readonly<{
  screenshots: readonly DashboardScreenshot[];
  stats: CreatorStats;
}>): ReactElement {
  const rows = useMemo(() => chunkRows(screenshots, CARDS_PER_ROW), [screenshots]);

  return (
    // The scrollbar's room is reserved, as it otherwise comes two frames after the content and
    // rewraps it.
    <Scrollable className={styles.grid} trackVisibility='reserve'>
      <GridRows rows={rows} stats={stats} />
    </Scrollable>
  );
}

function GridRows({
  rows,
  stats
}: Readonly<{
  rows: ReadonlyArray<readonly DashboardScreenshot[]>;
  stats: CreatorStats;
}>): ReactElement {
  const renderRow = useCallback(
    (index: number) => {
      const row = rows[index];

      // Keyed on its first card, so a row scrolled from one slot to the next keeps its elements,
      // and with them the thumbnails they already loaded.
      return (
        row && (
          <div key={row[0]?.id} className={styles.gridRow} data-dashboard-row={true}>
            {row.map(screenshot => (
              <div key={screenshot.id} className={styles.gridCell}>
                <DashboardCard screenshot={screenshot} stats={stats} />
              </div>
            ))}
          </div>
        )
      );
    },
    [rows, stats]
  );

  const { anchorRef, list } = useUniformVirtualList({
    count: rows.length,
    overscan: ROW_OVERSCAN,
    rowSelector: ROW_SELECTOR,
    estimatedRowHeightPx: ESTIMATED_ROW_HEIGHT_PX,
    renderRow
  });

  return (
    <>
      <div ref={anchorRef} />

      <div className={styles.gridRows}>
        {/* The cards' own focus scope: the panel's content hosts a single focusable child. */}
        <AutoNavigationScope>{list}</AutoNavigationScope>
      </div>
    </>
  );
}

const CARDS_PER_ROW = 5;

// Every row of the grid: its class name is hashed.
const ROW_SELECTOR = '[data-dashboard-row]';

/**
 * Rows kept rendered past each edge of the viewport,
 * low as each holds a row of thumbnails fetched from the CDN.
 */
const ROW_OVERSCAN = 1;

/**
 * What the first frames assume a row measures, before a rendered one is measured:
 * the row's height at the resolution where a `rem` is a pixel.
 */
const ESTIMATED_ROW_HEIGHT_PX = 260;
