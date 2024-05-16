/**
 * Extensions for menu UI components.
 */

import type { ModRegistrar, ModuleRegistryExtend } from 'cs2/modding';
import splashscreenStyles from './menu-splashscreen.module.scss';
import { MenuWrapper } from './menu-wrapper';

const MenuUIExtension: ModuleRegistryExtend = COMenuUI => props => (
    <MenuWrapper>
        <COMenuUI {...props} />
    </MenuWrapper>
);

export const register: ModRegistrar = moduleRegistry => {
    moduleRegistry.extend(
        'game-ui/menu/components/menu-ui.tsx',
        'MenuUI',
        MenuUIExtension
    );

    moduleRegistry.extend(
        'game-ui/menu/components/menu-ui.module.scss',
        splashscreenStyles
    );
};
