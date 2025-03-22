import type { ModRegistrar } from 'cs2/modding';
import { useModSettings } from '../utils';
import { LogoScreenWrapper } from './logo-screen-wrapper';

export const register: ModRegistrar = moduleRegistry => {
    moduleRegistry.extend(
        'game-ui/overlay/logo-screen/logo-screen.tsx',
        'LogoScreen',
        LogoScreen => props => {
            const { enableLoadingScreenBackground } = useModSettings();

            return enableLoadingScreenBackground ? (
                <LogoScreenWrapper>
                    <LogoScreen {...props} />
                </LogoScreenWrapper>
            ) : (
                <LogoScreen {...props} />
            );
        }
    );
};
