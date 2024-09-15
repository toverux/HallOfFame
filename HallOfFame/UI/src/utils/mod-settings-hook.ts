import { bindValue, useValue } from 'cs2/api';

export interface ModSettings {
    readonly creatorName: string;
    readonly creatorIdClue: string;
    readonly screenshotResolution: 'fhd' | '4k';
}

const settings$ = bindValue<ModSettings>('hallOfFame', 'settings', {
    creatorName: '',
    creatorIdClue: '',
    screenshotResolution: 'fhd'
});

export function useModSettings(): ModSettings {
    return useValue(settings$);
}
