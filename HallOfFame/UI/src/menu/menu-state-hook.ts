import { bindValue, useValue } from 'cs2/api';
import type { Dispatch } from 'react';
import { createSingletonHook } from '../utils';
import modLoadingErrorSrc from './mod-loading-error.jpg';

export interface CityInfo {
    readonly name: string;
    readonly creatorName: string;
    readonly milestone: number;
    readonly population: number;
    readonly postedAt: Date;
}

interface ReadonlyMenuState {
    readonly imageUri: string;
    readonly cityInfo: CityInfo | undefined;
}

interface SettableMenuState {
    readonly isMenuVisible: boolean;
}

const currentImageUri$ = bindValue<string>(
    'hallOfFame.menu',
    'currentImageUri',
    // Fallback binding value that is an image that indicates a problem with the
    // initialization of the .NET mod while the UI mod was still loaded.
    modLoadingErrorSrc
);

const currentCityInfo$ = bindValue<Record<string, unknown> | null>(
    'hallOfFame.menu',
    'currentImageCity',
    // Do not use undefined because it's interpreted as "no fallback", causing
    // an error on useValue() if there is a problem with the .NET mod.
    null
);

const useSingletonMenuState = createSingletonHook<SettableMenuState>({
    isMenuVisible: true
});

export function useHofMenuState(): [
    ReadonlyMenuState & SettableMenuState,
    Dispatch<SettableMenuState>
] {
    const [storedMenuState, setMenuState] = useSingletonMenuState();

    const imageUri = useValue(currentImageUri$);
    const cityInfo = useValue(currentCityInfo$);

    const menuState: ReadonlyMenuState & SettableMenuState = {
        ...storedMenuState,
        imageUri: imageUri,
        cityInfo: cityInfo
            ? {
                  name: String(cityInfo.name),
                  creatorName: String(cityInfo.creatorName),
                  milestone: Number(cityInfo.milestone),
                  population: Number(cityInfo.population),
                  postedAt: new Date(String(cityInfo.postedAt))
              }
            : undefined
    };

    return [menuState, setMenuState];
}
