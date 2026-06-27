import type { ModRegistrar } from 'cs2/modding';
import * as bindings from '../bindings';
import { LogoScreenWrapper } from './logo-screen-wrapper';

export const register: ModRegistrar = moduleRegistry => {
  moduleRegistry.extend(
    'game-ui/overlay/logo-screen/logo-screen.tsx',
    'LogoScreen',
    LogoScreen => props => {
      const { enableLoadingScreenBackground } = bindings.useModSettings();

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
