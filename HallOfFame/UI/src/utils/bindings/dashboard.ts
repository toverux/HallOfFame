import { trigger, useValue } from 'cs2/api';
import type { LocalizedString } from 'cs2/l10n';
import type { CreatorStats, DashboardScreenshot } from '../../common';
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

const state$ = lazyBindValue<DashboardState>(GROUP, 'state', { status: 'closed' });

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
