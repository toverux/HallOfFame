import classNames from 'classnames';
import { AutoNavigationScope, FocusDisabled } from 'cs2/input';
import { memo, type ReactElement, useEffect, useMemo, useState } from 'react';
import type { DashboardScreenshot } from '../../common';
import * as bindings from '../../utils/bindings';
import { Panel } from '../../vanilla-modules/game-ui/common/panel/panel';
import { iceflakePanelTheme } from '../../vanilla-modules/game-ui/common/panel/themes/iceflake-panel';
import { ModalBackdrop, ModalHost } from '../modal';
import {
  type DashboardFilter,
  type DashboardSort,
  filterScreenshots,
  sortScreenshots,
  tallyMedals
} from './dashboard-collection';
import { DashboardDetail } from './dashboard-detail';
import { DashboardGrid } from './dashboard-grid';
import {
  DashboardHeader,
  DashboardHeaderControls,
  DashboardHeaderDetail,
  DashboardHeaderSkeleton,
  DashboardSortDropdown
} from './dashboard-header';
import { DashboardEmpty, DashboardError, DashboardLoading } from './dashboard-status';
import * as styles from './creator-dashboard.module.scss';

/**
 * The Creator Dashboard: the creator's whole collection with its figures,
 * in a modal built from the game's own window parts.
 * C# owns whether it is open, so it renders wherever an entry point may open it,
 * and stays mounted while closed so the transition group it holds can play the panel's exit.
 */
export const CreatorDashboard = memo((): ReactElement => {
  const state = bindings.useDashboardState();

  const detail = bindings.useDashboardDetail();

  // Leaving the screen hosting the dashboard closes it, rather than leaving it to reopen on the
  // next visit.
  useEffect(() => bindings.closeDashboard, []);

  return (
    // A closing panel keeps the props it was last rendered with while its exit plays, so it holds
    // its content although C# empties the collection and closes the detail on close.
    <ModalHost>
      {state.status != 'closed' && <DashboardModal key='dashboard' state={state} detail={detail} />}
    </ModalHost>
  );
});

function DashboardModal({
  state,
  detail
}: Readonly<{
  state: Exclude<bindings.DashboardState, { status: 'closed' }>;
  detail: bindings.DashboardDetailState;
}>): ReactElement {
  // Held here rather than by the controls, and so reset on each opening: the transition group
  // mounts the modal afresh every time C# opens the panel.
  const [sort, setSort] = useState<DashboardSort>('newest');

  const [filter, setFilter] = useState<DashboardFilter>('all');

  const screenshots = state.status == 'loaded' ? state.screenshots : noScreenshots;

  // Sorted before it is filtered, which keeps the order: a tab switch costs a pass, not a sort.
  const sortedScreenshots = useMemo(() => sortScreenshots(screenshots, sort), [screenshots, sort]);

  const visibleScreenshots = useMemo(
    () => filterScreenshots(sortedScreenshots, filter),
    [sortedScreenshots, filter]
  );

  const tally = useMemo(() => tallyMedals(screenshots), [screenshots]);

  // While the edit form holds edits, every exit asks before dropping them, in the game's dialog.
  const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false);

  const close = hasUnsavedEdits ? bindings.confirmCloseDashboard : bindings.closeDashboard;

  const closeDetail = hasUnsavedEdits
    ? bindings.confirmCloseDashboardDetail
    : bindings.closeDashboardDetail;

  // The collection's own record of the screenshot the detail view is open on.
  const detailScreenshot =
    detail.status == 'closed'
      ? undefined
      : screenshots.find(screenshot => screenshot.id == detail.screenshotId);

  // Back steps out of the detail view first, as the game's nested menus do.
  const isDetailOpen = detailScreenshot != null;

  const backActions = useMemo(
    () => ({ Back: isDetailOpen ? closeDetail : close }),
    [isDetailOpen, close, closeDetail]
  );

  return (
    <ModalBackdrop actions={backActions} onClose={close}>
      {/* No title bar: the band carries the title and the close button itself. */}
      <Panel
        className={styles.window}
        contentClassName={styles.windowContent}
        theme={iceflakePanelTheme}
        onClose={close}>
        {/* The panel's content hosts a single focusable child. */}
        <AutoNavigationScope>
          <div className={styles.body}>
            <DashboardHeader onClose={close}>
              {detailScreenshot ? (
                <DashboardHeaderDetail screenshot={detailScreenshot} onBack={closeDetail} />
              ) : state.status == 'loading' ? (
                <DashboardHeaderSkeleton />
              ) : state.status == 'loaded' ? (
                <DashboardHeaderControls
                  stats={state.stats}
                  tally={tally}
                  filter={filter}
                  onFilterChange={setFilter}>
                  {screenshots.length > 0 && (
                    <DashboardSortDropdown sort={sort} onChange={setSort} />
                  )}
                </DashboardHeaderControls>
              ) : undefined}
            </DashboardHeader>

            <div className={styles.bodyContent}>
              {state.status == 'loading' && <DashboardLoading />}

              {state.status == 'error' && (
                <DashboardError
                  title='HallOfFame.UI.Dashboard.ERROR_TITLE'
                  error={state.error}
                  onRetry={bindings.refreshDashboard}
                />
              )}

              {state.status == 'loaded' && screenshots.length == 0 && <DashboardEmpty />}

              {/* A tab matching nothing leaves the body empty, its zero count saying why, rather
                  than hold a grid that would wait for a row to measure on every frame. */}
              {state.status == 'loaded' && visibleScreenshots.length > 0 && (
                // Hidden rather than unmounted under the detail view, so going back finds it
                // scrolled where it was, and out of the gamepad's reach meanwhile.
                <FocusDisabled disabled={detailScreenshot != null}>
                  <div
                    className={classNames(
                      styles.bodyGrid,
                      detailScreenshot && styles.bodyGridHidden
                    )}>
                    {/* Keyed on the selection, so a new one starts from the top rather than from
                        wherever the previous one was scrolled to. */}
                    <DashboardGrid
                      key={`${filter}-${sort}`}
                      screenshots={visibleScreenshots}
                      stats={state.stats}
                    />
                  </div>
                </FocusDisabled>
              )}

              {state.status == 'loaded' && detailScreenshot && detail.status != 'closed' && (
                <DashboardDetail
                  detail={detail}
                  screenshot={detailScreenshot}
                  screenshots={state.screenshots}
                  stats={state.stats}
                  onHasChangesChange={setHasUnsavedEdits}
                />
              )}
            </div>
          </div>
        </AutoNavigationScope>
      </Panel>
    </ModalBackdrop>
  );
}

// One empty collection for every state holding none, so the memos over it hold too.
const noScreenshots: readonly DashboardScreenshot[] = [];
