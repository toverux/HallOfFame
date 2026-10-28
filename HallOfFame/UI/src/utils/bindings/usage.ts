import { trigger } from 'cs2/api';

const GROUP = 'hallOfFame.usage';

/**
 * The usage events only the UI sees, each with its properties, which C# queues in
 * `HallOfFame.Services.UsageTracker` like its own.
 * Property values are strings alone, the one shape the trigger reads.
 */
interface UsageEvents {
  // C# stamps the `device` the game read input from.
  readonly slideshow_navigated: {
    readonly direction: 'previous' | 'next';
    readonly via: 'button' | 'action';
  };
  // On the closed-to-open transition only, the tab changes being their own event.
  readonly screenshot_details_opened: { readonly from: 'menu' | 'dashboard' };
  // The tab's ID, as the details window names it.
  readonly screenshot_details_tab_changed: { readonly tab: string };
  readonly viewer_opened: { readonly from: 'menu' | 'dashboard' };
  readonly viewer_link_copied: { readonly from: 'menu' };
  readonly more_actions_opened: Record<string, never>;
  readonly asset_mod_page_opened: { readonly from: 'controls' | 'details' };
  readonly social_link_opened: Record<string, never>;
}

export type UsageEventName = keyof UsageEvents;

/**
 * Tracks a usage event, dropped by C# while the player does not allow usage statistics.
 */
export function trackUsage<T extends UsageEventName>(name: T, properties: UsageEvents[T]): void {
  trigger(GROUP, 'trackUsage', name, properties);
}
