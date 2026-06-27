import { bindValue, trigger, useValue } from 'cs2/api';
import type { CreatorSocialLink, Mod } from '../common';

const GROUP = 'hallOfFame.common';

/** See C# `HallOfFame.Settings` class for documentation. */
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
  readonly savedShareModIdsPreference: boolean;
  readonly savedShareRenderSettingsPreference: boolean;
  readonly savedScreenshotDescription: string;
}

const settings$ = bindValue<ModSettings>(GROUP, 'settings', {
  creatorName: '',
  enableLoadingScreenBackground: true,
  showFeaturedAsset: true,
  showCreatorSocials: true,
  showViewCount: false,
  screenshotResolution: 'fhd',
  namesTranslationMode: 'translate',
  creatorsScreenshotSaveDirectory: '',
  baseUrl: '',
  savedShareModIdsPreference: true,
  savedShareRenderSettingsPreference: true,
  savedScreenshotDescription: ''
});

export function useModSettings(): ModSettings {
  return useValue(settings$);
}

const locale$ = bindValue<string>(GROUP, 'locale', 'en-US');

/**
 * Subscribes to the game's current locale (e.g. `en-US`), used to decide whether city and creator
 * names need translating.
 */
export function useLocale(): string {
  return useValue(locale$);
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
