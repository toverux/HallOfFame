import { bindValue, useValue } from 'cs2/api';
import type { Dispatch } from 'react';
import { createSingletonHook } from '../utils';
import modLoadingErrorSrc from './mod-loading-error.jpg';

interface ReadonlyMenuState {
    readonly currentImageUri: string;
}

interface SettableMenuState {
    readonly isMenuVisible: boolean;
}

const currentImageUri$ = bindValue<string>(
    'hallOfFame.menu',
    'currentImageUri',
    // This is the Vanilla image when the mod was written.
    // Used here as a fallback in case the C# binding fails, which should really
    // not happen.
    modLoadingErrorSrc
);

const useSingletonMenuState = createSingletonHook<SettableMenuState>({
    isMenuVisible: true
});

export function useHofMenuState(): [
    ReadonlyMenuState & SettableMenuState,
    Dispatch<SettableMenuState>
] {
    const [storedMenuState, setMenuState] = useSingletonMenuState();

    const currentImageUri = useValue(currentImageUri$);

    const menuState: ReadonlyMenuState & SettableMenuState = {
        ...storedMenuState,
        currentImageUri
    };

    return [menuState, setMenuState];
}
