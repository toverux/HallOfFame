import type { ModRegistrar } from 'cs2/modding';
import { LogoScreenWrapper } from './logo-screen-wrapper';

export const register: ModRegistrar = moduleRegistry => {
    moduleRegistry.extend(
        'game-ui/overlay/logo-screen/logo-screen.tsx',
        'LogoScreen',
        LogoScreen => props => (
            <LogoScreenWrapper>
                <LogoScreen {...props} />
            </LogoScreenWrapper>
        )
    );
};
