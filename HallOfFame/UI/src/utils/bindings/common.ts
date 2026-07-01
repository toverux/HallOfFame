import { trigger, useValue } from 'cs2/api';
import type { CreatorSocialLink, Mod } from '../../common';
import { lazyBindValue } from './lazy-value-binding';

const GROUP = 'hallOfFame.common';

/**
 * @public
 * See C# `HallOfFame.Settings` class for documentation.
 */
export interface ModSettings {
  readonly creatorName: string;
  readonly enableLoadingScreenBackground: boolean;
  readonly showFeaturedAsset: boolean;
  readonly showCreatorSocials: boolean;
  readonly showViewCount: boolean;
  readonly screenshotResolution: 'fhd' | '4k';
  readonly namesTranslationMode: 'disabled' | 'transliterate' | 'translate';
  readonly creatorsScreenshotSaveDirectory: string;
  readonly baseUrl: string;
}

const settings$ = lazyBindValue<ModSettings>(GROUP, 'settings', {
  creatorName: '',
  enableLoadingScreenBackground: true,
  showFeaturedAsset: true,
  showCreatorSocials: true,
  showViewCount: false,
  screenshotResolution: 'fhd',
  namesTranslationMode: 'translate',
  creatorsScreenshotSaveDirectory: '',
  baseUrl: ''
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

export function openModPage(mod: Mod): void {
  trigger(GROUP, 'openModPage', mod.paradoxModId);
}

export function openSocialLink({ platform, link }: CreatorSocialLink): void {
  if (platform == 'paradoxmods') {
    trigger(GROUP, 'openCreatorPage', link);
  } else {
    trigger(GROUP, 'openWebPage', link);
  }
}

/**
 * Logs a JavaScript error to the mod's C# logs (not only the UI console), and shows an error dialog
 * when {@link fatal} is set.
 */
export function logJavaScriptError(fatal: boolean, errorString: string | undefined): void {
  trigger(GROUP, 'logJavaScriptError', fatal, errorString);
}
