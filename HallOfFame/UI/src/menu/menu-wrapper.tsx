/**
 * Component that wraps the entire menu, managing the state of HoF's logic and
 * rendering the splashscreen and its controls.
 */

import { bindValue, useValue } from 'cs2/api';
import type { ReactElement, ReactNode } from 'react';
import { MenuControls } from './menu-controls';
import { MenuSplashscreen } from './menu-splashscreen';
import modLoadingErrorSrc from './mod-loading-error.jpg';

const currentImageUri$ = bindValue<string>(
    'hallOfFame.menu',
    'currentImageUri',
    // This is the Vanilla image when the mod was written.
    // Used here as a fallback in case the C# binding fails, which should really
    // not happen.
    modLoadingErrorSrc
);

interface Props {
    readonly children: ReactNode;
}

/**
 * This component wraps the entire menu UI, managing the shared state of other
 * HoF components inside it.
 */
export function MenuWrapper({ children }: Props): ReactElement {
    const currentImageUri = useValue(currentImageUri$);

    return (
        <>
            <MenuSplashscreen imageUri={currentImageUri} />
            {children}
            <MenuControls />
        </>
    );
}
