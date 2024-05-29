/**
 * Extensions for menu UI components.
 */

import type { ModRegistrar } from 'cs2/modding';
import * as splashscreenStyles from './menu-splashscreen.module.scss';
import { MenuWrapper } from './menu-wrapper';

export const register: ModRegistrar = moduleRegistry => {
    moduleRegistry.extend(
        'game-ui/menu/components/menu-ui.tsx',
        'MenuUI',
        COMenuUI => props => (
            <MenuWrapper>
                <COMenuUI {...props} />
            </MenuWrapper>
        )
    );

    moduleRegistry.extend(
        'game-ui/menu/components/menu-ui.module.scss',
        splashscreenStyles
    );
};
