import { trigger, useValue } from 'cs2/api';
import type { CreatorSocialLink, Mod } from '../../common';
import { lazyBindValue } from './lazy-value-binding';
import { trackUsage } from './usage';

const GROUP = 'hallOfFame.common';

/**
 * See C# `HallOfFame.Settings` class for documentation.
 */
export interface ModSettings {
  readonly creatorName: string;
  readonly enableLoadingScreenBackground: boolean;
  readonly showFeaturedAsset: boolean;
  readonly showCreatorSocials: boolean;
  readonly showCityInfo: boolean;
  readonly showViewCount: boolean;
  readonly showScreenshotDetails: boolean;
  readonly screenshotResolution: 'fhd' | '4k';
  readonly namesTranslationMode: 'disabled' | 'transliterate' | 'translate';
  readonly creatorsScreenshotSaveDirectory: string;
  readonly baseUrl: string;
  /**
   * The player's public creator ID, `null` until the mod first logs in.
   */
  readonly publicCreatorId: string | null;
}

const settings$ = lazyBindValue<ModSettings>(GROUP, 'settings', {
  creatorName: '',
  enableLoadingScreenBackground: true,
  showFeaturedAsset: true,
  showCreatorSocials: true,
  showCityInfo: true,
  showViewCount: false,
  showScreenshotDetails: true,
  screenshotResolution: 'fhd',
  namesTranslationMode: 'translate',
  creatorsScreenshotSaveDirectory: '',
  baseUrl: '',
  publicCreatorId: null
});

export function useModSettings(): ModSettings {
  return useValue(settings$());
}

/**
 * Imperatively subscribes to the mod settings, invoking [listener] once with the current value and
 * again on every change.
 *
 * The React counterpart is {@link useModSettings}; this non-React form exists for the keep-alive
 * manager, which runs outside the component tree (see `installKeepAliveImages`).
 * Returns a disposer that ends the subscription.
 */
export function subscribeToModSettings(listener: (settings: ModSettings) => void): () => void {
  const subscription = settings$().subscribe(() => listener(settings$().value));

  listener(settings$().value);

  return () => subscription.dispose();
}

const locale$ = lazyBindValue<string>(GROUP, 'locale', 'en-US');

/**
 * Subscribes to the game's current locale (e.g. `en-US`), used to decide whether city and creator
 * names need translating.
 */
export function useLocale(): string {
  return useValue(locale$());
}

export function openModSettings(tab: string): void {
  trigger(GROUP, 'openModSettings', tab);
}

/**
 * Opens a mod's Paradox Mods page, tracked with the place it was opened {@link from}.
 */
export function openModPage(mod: Mod, from: 'controls' | 'details'): void {
  trigger(GROUP, 'openModPage', mod.paradoxModId);

  trackUsage('asset_mod_page_opened', { from });
}

/**
 * Opens a creator's social link, on Paradox Mods or in the player's default browser, and tracks it.
 */
export function openSocialLink({ platform, link }: CreatorSocialLink): void {
  if (platform == 'paradoxmods') {
    trigger(GROUP, 'openCreatorPage', link);
  } else {
    trigger(GROUP, 'openWebPage', link);
  }

  trackUsage('social_link_opened', {});
}

/**
 * Opens a web viewer link in the player's default browser, {@link url} being the server's tracked
 * redirect so that the visit is counted, and tracks the place it was opened {@link from}.
 */
export function openViewerLink(url: string, from: 'menu' | 'dashboard'): void {
  trigger(GROUP, 'openViewerLink', url);

  trackUsage('viewer_opened', { from });
}

/**
 * Puts a web viewer link on the system clipboard, {@link url} being the plain viewer page rather
 * than the tracked redirect, which is what belongs in a shared link, and tracks the place it was
 * copied {@link from}.
 */
export function copyViewerLink(url: string, from: 'menu'): void {
  trigger(GROUP, 'copyViewerLink', url);

  trackUsage('viewer_link_copied', { from });
}

/**
 * Logs a JavaScript error to the mod's C# logs (not only the UI console), and shows an error dialog
 * when {@link fatal} is set.
 */
export function logJavaScriptError(fatal: boolean, errorString: string | undefined): void {
  trigger(GROUP, 'logJavaScriptError', fatal, errorString);
}
