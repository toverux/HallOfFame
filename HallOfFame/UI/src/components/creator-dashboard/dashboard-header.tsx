import classNames from 'classnames';
import { LocalizedNumber, LocalizedString } from 'cs2/l10n';
import { Button, Dropdown, DropdownItem, type DropdownTheme, DropdownToggle, Icon } from 'cs2/ui';
import type { ReactElement, ReactNode } from 'react';
import type { CreatorStats } from '../../common';
import circleRegularSrc from '../../icons/fontawesome/circle-regular.svg';
import grid2RegularSrc from '../../icons/fontawesome/grid-2-regular.svg';
import logoSrc from '../../icons/stats-notification.svg';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { skinDropdownTheme } from '../../vanilla-modules/game-ui/common/input/dropdown/dropdown';
import { Tooltip } from '../tooltip';
import {
  type DashboardFilter,
  dashboardFilters,
  type DashboardSort,
  dashboardSorts,
  type MedalTally
} from './dashboard-collection';
import { MedalImage, MedalTooltip } from './dashboard-medal';
import * as styles from './dashboard-header.module.scss';

/**
 * The window's one band, in place of a title bar:
 * the mod's logo and the window's name at its start, the close button at its end,
 * and between them whatever the collection's state has to show, which `children` carries.
 * Nothing there paints the band's rest, so the band reads whole when there is nothing to show.
 */
export function DashboardHeader({ children }: Readonly<{ children?: ReactNode }>): ReactElement {
  const translate = useTranslate();

  return (
    <div className={styles.header}>
      <div className={styles.headerBrand}>
        {/* noinspection HtmlRequiredAltAttribute */}
        <img src={logoSrc} className={styles.headerLogo} />

        <div className={styles.headerTitle}>
          <div className={styles.headerTitleKicker}>
            {translate('HallOfFame.UI.Dashboard.TITLE[Creator]')}
          </div>

          <div>{translate('HallOfFame.UI.Dashboard.TITLE[Dashboard]')}</div>
        </div>
      </div>

      {children ?? <div className={styles.headerRest} />}

      <div className={styles.headerEnd}>
        <Button
          theme={plainButtonTheme}
          className={styles.headerClose}
          onSelect={bindings.closeDashboard}
          selectSound='close-menu'>
          <Icon src='Media/Glyphs/Close.svg' tinted={true} className={styles.headerCloseGlyph} />
        </Button>
      </div>
    </div>
  );
}

/**
 * The band's controls over a loaded collection:
 * the creator's totals, then the tabs narrowing the grid to one medal, with a count of each,
 * and at the end the sort control,
 * which `children` carries so an empty collection can go without it.
 */
export function DashboardHeaderControls({
  stats,
  tally,
  filter,
  onFilterChange,
  children
}: Readonly<{
  stats: CreatorStats;
  tally: MedalTally;
  filter: DashboardFilter;
  onFilterChange: (filter: DashboardFilter) => void;
  children?: ReactNode;
}>): ReactElement {
  const translate = useTranslate();

  return (
    <>
      <div className={styles.headerStanding}>
        <div className={styles.headerRule} />

        <div className={styles.headerTotals}>
          {totals.map(({ id, select }) => (
            <div key={id} className={styles.headerTotal}>
              <div className={styles.headerTotalValue}>
                <LocalizedNumber value={select(stats)} />
              </div>

              <div className={styles.headerTotalLabel}>{translate(id)}</div>
            </div>
          ))}
        </div>

        <div className={styles.headerRule} />
      </div>

      <div className={styles.headerTabs}>
        {dashboardFilters.map(option => (
          <Tooltip
            key={option}
            direction='down'
            tooltip={<TabTooltip filter={option} stats={stats} />}>
            <Button
              theme={plainButtonTheme}
              className={classNames(styles.headerTab, option == filter && styles.headerTabSelected)}
              selected={option == filter}
              onSelect={() => onFilterChange(option)}
              data-tally={option}
              data-selected={option == filter}>
              <div className={styles.headerTabFace}>
                <TabIcon filter={option} />

                <LocalizedNumber value={tally[option]} />
              </div>
            </Button>
          </Tooltip>
        ))}
      </div>

      <div className={styles.headerRest}>{children}</div>
    </>
  );
}

/**
 * The controls' shape while the collection loads,
 * each figure a blank bar in the box its text will take,
 * so the band keeps its height and nothing below it jumps when the figures land.
 */
export function DashboardHeaderSkeleton(): ReactElement {
  const translate = useTranslate();

  return (
    <>
      <div className={styles.headerStanding}>
        <div className={styles.headerRule} />

        <div className={styles.headerTotals}>
          {totals.map(({ id }) => (
            <div key={id} className={styles.headerTotal}>
              <div className={styles.headerTotalValue}>
                <Blank className={styles.headerBarValue} />
              </div>

              <div className={styles.headerTotalLabel}>
                <Blank className={styles.headerBarLabel} />
              </div>
            </div>
          ))}
        </div>

        <div className={styles.headerRule} />
      </div>

      <div className={styles.headerTabs} data-dashboard-skeleton={true}>
        {dashboardFilters.map(option => (
          <div key={option} className={classNames(styles.headerTab, styles.headerTabPlaceholder)}>
            <div className={styles.headerTabFace}>
              <TabIcon filter={option} />

              <Blank className={styles.headerBarCount} />
            </div>
          </div>
        ))}
      </div>

      <div className={styles.headerRest}>
        <div className={styles.sort}>
          <span className={styles.sortLabel}>
            {translate('HallOfFame.UI.Dashboard.SORT_LABEL')}
          </span>

          <div className={styles.sortToggle}>
            <Blank className={styles.headerBarSort} />
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The grid's order, which the dashboard holds: the dropdown only shows it and reports a pick.
 */
export function DashboardSortDropdown({
  sort,
  onChange
}: Readonly<{
  sort: DashboardSort;
  onChange: (sort: DashboardSort) => void;
}>): ReactElement {
  const translate = useTranslate();

  return (
    <div className={styles.sort}>
      <span className={styles.sortLabel}>{translate('HallOfFame.UI.Dashboard.SORT_LABEL')}</span>

      <Dropdown
        theme={sortDropdownTheme}
        content={dashboardSorts.map(option => (
          <DropdownItem<DashboardSort>
            key={option}
            value={option}
            selected={option == sort}
            onChange={onChange}>
            {translate(sortLabelIds[option])}
          </DropdownItem>
        ))}>
        <DropdownToggle data-sort={sort}>
          {translate(sortLabelIds[sort])}

          {/* Every label, unseen, so the toggle is as wide as the widest and never resizes. */}
          {dashboardSorts.map(option => (
            <div key={option} className={styles.sortToggleSizer}>
              {translate(sortLabelIds[option])}
            </div>
          ))}
        </DropdownToggle>
      </Dropdown>
    </div>
  );
}

/**
 * A bar standing in for a line of text, in a box as tall as the line it stands in for.
 */
function Blank({ className }: Readonly<{ className: string }>): ReactElement {
  return (
    <div className={styles.headerBlank}>
      <div className={classNames(styles.headerBar, className)} />
    </div>
  );
}

/**
 * A medal for its tier, and a glyph for the two filters that are no medal:
 * the whole collection, and the screenshots without one.
 */
function TabIcon({ filter }: Readonly<{ filter: DashboardFilter }>): ReactElement {
  if (filter == 'all') {
    return <Icon src={grid2RegularSrc} tinted={true} className={styles.headerTabGlyph} />;
  }

  if (filter == 'unranked') {
    return <Icon src={circleRegularSrc} tinted={true} className={styles.headerTabGlyph} />;
  }

  return <MedalImage rank={filter} className={styles.headerTabMedal} />;
}

/**
 * What a tab narrows the grid to, and for the screenshots without a medal,
 * what it takes to earn one, the thresholds the server sets.
 */
function TabTooltip({
  filter,
  stats
}: Readonly<{ filter: DashboardFilter; stats: CreatorStats }>): ReactElement {
  const translate = useTranslate();

  if (filter == 'all') {
    return <>{translate('HallOfFame.UI.Dashboard.TAB_TOOLTIP[All]')}</>;
  }

  if (filter == 'unranked') {
    return (
      <div className={styles.tabTooltip}>
        <strong>{translate('HallOfFame.UI.Dashboard.TAB_TOOLTIP[Unranked]')}</strong>

        <div className={styles.tabTooltipDetail}>
          <LocalizedString
            id='HallOfFame.UI.Dashboard.TAB_TOOLTIP[Unranked Detail]'
            args={{
              MIN_UNIQUE_VIEWS_COUNT: <LocalizedNumber value={stats.rankMinUniqueViewsCount} />,
              MIN_LIKES_COUNT: <LocalizedNumber value={stats.rankMinLikesCount} />
            }}
          />
        </div>
      </div>
    );
  }

  return <MedalTooltip rank={filter} />;
}

// The vanilla button's own looks go: a tab and the close button are drawn by the band's
// stylesheet alone.
const plainButtonTheme = { button: '' };

const totals: ReadonlyArray<{ id: string; select: (stats: CreatorStats) => number }> = [
  { id: 'HallOfFame.UI.Dashboard.TOTAL[Views]', select: stats => stats.viewsCount },
  { id: 'HallOfFame.UI.Dashboard.TOTAL[Unique Views]', select: stats => stats.uniqueViewsCount },
  { id: 'HallOfFame.UI.Dashboard.TOTAL[Likes]', select: stats => stats.likesCount }
];

// The window's own dark for the control, where the game's default toggle is the white of its
// in-game forms.
const sortDropdownTheme: Partial<DropdownTheme> = skinDropdownTheme({
  dropdownToggle: styles.sortToggle,
  label: styles.sortToggleLabel,
  indicator: styles.sortToggleIndicator,
  dropdownPopup: styles.sortPopup,
  dropdownMenu: styles.sortMenu,
  dropdownItem: styles.sortItem
});

const sortLabelIds: Readonly<Record<DashboardSort, string>> = {
  newest: 'HallOfFame.UI.Dashboard.SORT[Newest]',
  oldest: 'HallOfFame.UI.Dashboard.SORT[Oldest]',
  mostLiked: 'HallOfFame.UI.Dashboard.SORT[Most Liked]',
  leastLiked: 'HallOfFame.UI.Dashboard.SORT[Least Liked]',
  mostViewed: 'HallOfFame.UI.Dashboard.SORT[Most Viewed]',
  bestRank: 'HallOfFame.UI.Dashboard.SORT[Best Medal]'
};
