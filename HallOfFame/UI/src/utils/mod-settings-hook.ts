import { bindValue, useValue } from 'cs2/api';

/** See C# `HallOfFame.Settings` class for documentation. */
export interface ModSettings {
  readonly creatorName: string;
  readonly enableLoadingScreenBackground: boolean;
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

const settings$ = bindValue<ModSettings>('hallOfFame.common', 'settings', {
  creatorName: '',
  enableLoadingScreenBackground: true,
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
