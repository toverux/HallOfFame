import { trigger, useValue } from 'cs2/api';
import type { LocalizedString } from 'cs2/l10n';
import type { CreatorStats, DashboardScreenshot, Screenshot } from '../../common';
import type { JsonMod } from './capture';
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
      // Whether an edit of it is on its way to the server.
      readonly isSaving: boolean;
      // Whether its deletion is on its way to the server.
      readonly isDeleting: boolean;
    }
  | { readonly status: 'error'; readonly screenshotId: string; readonly error: LocalizedString };

/**
 * Serialization of C# `HallOfFame.Services.ScreenshotUpdate`: the fields of a screenshot the edit
 * form changed, each absent when unchanged.
 */
export interface ScreenshotUpdate {
  readonly cityName?: string;
  // Empty clears it.
  readonly description?: string;
  // A Paradox Mods ID, empty to clear it, as for the description.
  readonly showcasedModId?: string;
  readonly shareParadoxModIds?: boolean;
  readonly shareRenderSettings?: boolean;
}

const state$ = lazyBindValue<DashboardState>(GROUP, 'state', { status: 'closed' });

const detail$ = lazyBindValue<DashboardDetailState>(GROUP, 'detail', { status: 'closed' });

// Empty until the dashboard opens, and when the playset cannot be read.
const assetMods$ = lazyBindValue<readonly JsonMod[]>(GROUP, 'assetMods', []);

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

/**
 * Subscribes to the active playset's asset mods, read on each open: the ones the edit form offers
 * to showcase, in the shape the upload panel's picker takes.
 */
export function useDashboardAssetMods(): readonly JsonMod[] {
  return useValue(assetMods$());
}

/**
 * Saves an edit of the screenshot the detail view holds; ignored while another is saving.
 */
export function updateDashboardScreenshot(update: ScreenshotUpdate): void {
  trigger(GROUP, 'update', update);
}

/**
 * Deletes the screenshot the detail view holds, once the player confirms it in the game's dialog;
 * ignored while another mutation is on its way.
 */
export function deleteDashboardScreenshot(): void {
  trigger(GROUP, 'delete');
}

/**
 * Shows the screenshot the detail view holds in the slideshow, closing the dashboard over it.
 */
export function showDashboardScreenshotInSlideshow(): void {
  trigger(GROUP, 'showInSlideshow');
}
