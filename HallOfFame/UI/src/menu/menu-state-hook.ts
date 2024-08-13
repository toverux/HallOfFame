import { bindValue, useValue } from 'cs2/api';
import type { Dispatch } from 'react';
import type { Screenshot } from '../common';
import { createSingletonHook, useModSettings } from '../utils';
import modLoadingErrorSrc from './mod-loading-error.jpg';

interface ReadonlyMenuState {
    /**
     * Current image to display, derived from `hallOfFame.menu.defaultImageUri`
     * binding or (depending on quality setting) {@link screenshot.imageUrlFHD}
     * or {@link screenshot.imageUrl4K}.
     */
    readonly imageUri: string;

    /**
     * Whether a new screenshot is being loaded and/or a screenshot image is
     * being preloaded.
     *
     * @default false
     */
    readonly isRefreshing: boolean;

    /**
     * Current screenshot data, or `null` when no data is available yet.
     */
    readonly screenshot: Screenshot | null;
}

interface SettableMenuState {
    /**
     * Whether the main game menu is visible or hidden by the user.
     *
     * @default true
     */
    readonly isMenuVisible: boolean;

    /**
     * Whether the UI is ready to display a new image, that includes:
     * - The current image has been fully loaded.
     * - The next image has been fully preloaded.
     * - The current image has finished its fade-in animation (so there are no
     *   "jumps" in the animation and there is no need for the user to be able
     *   to hit Next every .5 seconds).
     */
    readonly isReadyForNextImage: boolean;
}

const defaultImageUri$ = bindValue<string>(
    'hallOfFame.menu',
    'defaultImageUri',
    // Fallback binding value that is an image that indicates a problem with the
    // initialization of the .NET mod while the UI mod was still loaded.
    modLoadingErrorSrc
);

const isRefreshing$ = bindValue<boolean>(
    'hallOfFame.menu',
    'isRefreshing',
    false
);

const currentScreenshot$ = bindValue<Screenshot | null>(
    'hallOfFame.menu',
    'currentScreenshot',
    // Do not use undefined because it's interpreted as "no fallback", causing
    // an error on useValue() if there is a problem with the .NET mod.
    null
);

const useSingletonMenuState = createSingletonHook<SettableMenuState>({
    isMenuVisible: true,
    isReadyForNextImage: true
});

export function useHofMenuState(): [
    ReadonlyMenuState & SettableMenuState,
    Dispatch<SettableMenuState>
] {
    const settings = useModSettings();
    const [settableMenuState, setMenuState] = useSingletonMenuState();

    const defaultImageUri = useValue(defaultImageUri$);
    const isRefreshing = useValue(isRefreshing$);
    const screenshot = useValue(currentScreenshot$);

    const menuState: ReadonlyMenuState & SettableMenuState = {
        ...settableMenuState,
        isRefreshing,
        imageUri: screenshot
            ? settings.screenshotResolution == 'fhd'
                ? screenshot.imageUrlFHD
                : screenshot.imageUrl4K
            : defaultImageUri,
        screenshot
    };

    return [menuState, setMenuState];
}
