import { bindValue, useValue } from 'cs2/api';

export interface ModSettings {
    readonly creatorName: string;
    readonly creatorIdClue: string;
    readonly showCreatorSocials: boolean;
    readonly showViewCount: boolean;
    readonly screenshotResolution: 'fhd' | '4k';
    readonly creatorsScreenshotSaveDirectory: string;
    readonly baseUrl: string;
}

const settings$ = bindValue<ModSettings>('hallOfFame', 'settings', {
    creatorName: '',
    creatorIdClue: '',
    showCreatorSocials: true,
    showViewCount: false,
    screenshotResolution: 'fhd',
    creatorsScreenshotSaveDirectory: '',
    baseUrl: ''
});

export function useModSettings(): ModSettings {
    return useValue(settings$);
}
