import { bindValue, useValue } from 'cs2/api';

interface JsonSettings {
    readonly creatorName: string;
    readonly creatorIdClue: string;
    readonly screenshotResolution: 'fhd' | '4k';
}

const settings$ = bindValue<JsonSettings>('hallOfFame', 'settings');

export function useModSettings(): JsonSettings {
    return useValue(settings$);
}
