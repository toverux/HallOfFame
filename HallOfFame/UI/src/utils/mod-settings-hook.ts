import { bindValue, useValue } from 'cs2/api';

export interface ModSettings {
  readonly creatorName: string;
  readonly creatorIdClue: string;
  readonly enableLoadingScreenBackground: boolean;
  readonly showCreatorSocials: boolean;
  readonly showViewCount: boolean;
  readonly screenshotResolution: 'fhd' | '4k';
  readonly namesTranslationMode: 'disabled' | 'transliterate' | 'translate';
  readonly creatorsScreenshotSaveDirectory: string;
  readonly baseUrl: string;
}

const settings$ = bindValue<ModSettings>('hallOfFame.common', 'settings', {
  creatorName: '',
  creatorIdClue: '',
  enableLoadingScreenBackground: true,
  showCreatorSocials: true,
  showViewCount: false,
  screenshotResolution: 'fhd',
  namesTranslationMode: 'translate',
  creatorsScreenshotSaveDirectory: '',
  baseUrl: ''
});

export function useModSettings(): ModSettings {
  return useValue(settings$);
}
