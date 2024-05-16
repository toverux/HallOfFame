/**
 * Component that wraps the entire menu, managing the state of HoF's logic and
 * rendering the splashscreen and its controls.
 */

import { type ReactElement, type ReactNode, useState } from 'react';
import { MenuControls } from './menu-controls';
import { MenuSplashscreen } from './menu-splashscreen';

// This is the Vanilla image when the mod was written.
// It could be retrieved dynamically from calculated styles before we apply our
// override class, but it's unlikely to change. (right?)
const defaultSplashSrc = 'Media/Menu/Background2.jpg';

interface Props {
    readonly children: ReactNode;
}

/**
 * This component wraps the entire menu UI, managing the shared state of other
 * HoF components inside it.
 */
export function MenuWrapper({ children }: Props): ReactElement {
    const [imageUri, setImageUri] = useState(defaultSplashSrc);

    // @todo For debug, remove on release.
    // biome-ignore lint/suspicious/noExplicitAny: todo
    (window as any).loadNewImage = setImageUri;

    return (
        <>
            <MenuSplashscreen imageUri={imageUri} />
            {children}
            <MenuControls />
        </>
    );
}
