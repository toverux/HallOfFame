/**
 * Extensions for menu UI components.
 */

import type { ModRegistrar } from 'cs2/modding';
import { MasterScreenPortal } from './master-screen-portal';
import { MenuSplashscreen } from './menu-splashscreen';
import { useHofMenuState } from './menu-state-hook';

export const register: ModRegistrar = moduleRegistry => {
  moduleRegistry.extend(
    'game-ui/menu/components/menu-ui-backdrops/menu-ui-backdrops.tsx',
    'MenuUIBackdrops',
    MenuUIBackdrops => props => {
      const [{ isSlideshowEnabled }] = useHofMenuState();

      return isSlideshowEnabled ? <></> : <MenuUIBackdrops {...props} />;
    }
  );

  moduleRegistry.extend('game-ui/menu/components/menu-ui.tsx', 'MenuUI', COMenuUI => props => {
    const [{ isSlideshowEnabled }] = useHofMenuState();

    return isSlideshowEnabled ? (
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
      const [{ isSlideshowEnabled }] = useHofMenuState();

      return isSlideshowEnabled ? (
        <MasterScreenPortal>
          <COMasterScreen {...props} />
        </MasterScreenPortal>
      ) : (
        <COMasterScreen {...props} />
      );
    }
  );
};
