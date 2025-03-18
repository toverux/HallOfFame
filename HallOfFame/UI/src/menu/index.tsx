/**
 * Extensions for menu UI components.
 */

import type { ModRegistrar } from 'cs2/modding';
import { MasterScreenPortal } from './master-screen-portal';
import { MenuSplashscreen } from './menu-splashscreen';
import * as splashscreenStyles from './menu-splashscreen.module.scss';

export const register: ModRegistrar = moduleRegistry => {
    moduleRegistry.override(
        'game-ui/menu/components/menu-ui-backdrops/menu-ui-backdrops.tsx',
        'MenuUIBackdrops',
        () => null
    );

    moduleRegistry.extend(
        'game-ui/menu/components/menu-ui.module.scss',
        splashscreenStyles
    );

    moduleRegistry.extend(
        'game-ui/menu/components/menu-ui.tsx',
        'MenuUI',
        COMenuUI => props => (
            <>
                <MenuSplashscreen />
                <COMenuUI {...props} />
            </>
        )
    );

    moduleRegistry.extend(
        'game-ui/menu/components/shared/master-screen/master-screen.tsx',
        'MasterScreen',
        COMasterScreen => props => {
            return (
                <MasterScreenPortal>
                    <COMasterScreen {...props} />
                </MasterScreenPortal>
            );
        }
    );
};
