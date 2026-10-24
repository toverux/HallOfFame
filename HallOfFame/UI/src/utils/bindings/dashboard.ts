import { trigger, useValue } from 'cs2/api';
import type { LocalizedString } from 'cs2/l10n';
import type { CreatorStats, DashboardScreenshot, Screenshot } from '../../common';
import { lazyBindValue } from './lazy-value-binding';

const GROUP = 'hallOfFame.dashboard';

/**
 * Serialization of C# `HallOfFame.Services.DashboardState`: where the Creator Dashboard stands,
 * `closed` meaning the panel is not shown, each status with the payload it alone carries.
 */
export type DashboardState =
  | { readonly status: 'closed' }
  | { readonly status: 'loading' }
  | {
      readonly status: 'loaded';
      // The creator's whole collection, in the server's order.
      readonly screenshots: readonly DashboardScreenshot[];
      // The creator's totals and ranking thresholds.
      readonly stats: CreatorStats;
    }
  | { readonly status: 'error'; readonly error: LocalizedString };

/**
 * Serialization of C# `HallOfFame.Services.DashboardDetailState`: where the detail view stands,
 * `closed` meaning the grid shows, else the screenshot it opened on, fetched in full.
 */
export type DashboardDetailState =
  | { readonly status: 'closed' }
  | { readonly status: 'loading'; readonly screenshotId: string }
  | {
      readonly status: 'loaded';
      readonly screenshotId: string;
      // The full screenshot, its showcased mod included.
      readonly screenshot: Screenshot;
    }
  | { readonly status: 'error'; readonly screenshotId: string; readonly error: LocalizedString };

const state$ = lazyBindValue<DashboardState>(GROUP, 'state', { status: 'closed' });

const detail$ = lazyBindValue<DashboardDetailState>(GROUP, 'detail', { status: 'closed' });

/**
 * Subscribes to the dashboard's state, which C# owns,
 * so the panel is open exactly when it is not `closed`.
 */
export function useDashboardState(): DashboardState {
  return useValue(state$());
}

/**
 * Opens the dashboard, fetching the collection afresh; ignored while a load is in flight.
 */
export function openDashboard(): void {
  trigger(GROUP, 'open');
}

export function closeDashboard(): void {
  trigger(GROUP, 'close');
}

/**
 * Fetches the collection again while the dashboard is open, the error view's retry.
 */
export function refreshDashboard(): void {
  trigger(GROUP, 'refresh');
}

/**
 * Subscribes to the detail view's state, which C# owns, so the grid shows while it is `closed`.
 */
export function useDashboardDetail(): DashboardDetailState {
  return useValue(detail$());
}

/**
 * Opens the detail view on a screenshot of the collection, fetching it in full;
 * opening it again after a failure is the detail's retry.
 */
export function openDashboardDetail(screenshotId: string): void {
  trigger(GROUP, 'openDetail', screenshotId);
}

/**
 * Returns from the detail view to the grid.
 */
export function closeDashboardDetail(): void {
  trigger(GROUP, 'closeDetail');
}
