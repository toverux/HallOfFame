/**
 * Extensions for menu UI components.
 */

import type { ModRegistrar } from 'cs2/modding';
import { useModSettings } from '../utils';
import { MasterScreenPortal } from './master-screen-portal';
import { MenuSplashscreen } from './menu-splashscreen';

export const register: ModRegistrar = moduleRegistry => {
  moduleRegistry.extend(
    'game-ui/menu/components/menu-ui-backdrops/menu-ui-backdrops.tsx',
    'MenuUIBackdrops',
    MenuUIBackdrops => props => {
      const { enableMainMenuSlideshow } = useModSettings();

      return enableMainMenuSlideshow ? <></> : <MenuUIBackdrops {...props} />;
    }
  );

  moduleRegistry.extend('game-ui/menu/components/menu-ui.tsx', 'MenuUI', COMenuUI => props => {
    const { enableMainMenuSlideshow } = useModSettings();

    return enableMainMenuSlideshow ? (
      <>
        <MenuSplashscreen />
        <COMenuUI {...props} />
      </>
    ) : (
      <COMenuUI {...props} />
    );
  });

  moduleRegistry.extend(
    'game-ui/menu/components/shared/master-screen/master-screen.tsx',
    'MasterScreen',
    COMasterScreen => props => {
      const { enableMainMenuSlideshow } = useModSettings();

      return enableMainMenuSlideshow ? (
        <MasterScreenPortal>
          <COMasterScreen {...props} />
        </MasterScreenPortal>
      ) : (
        <COMasterScreen {...props} />
      );
    }
  );
};
