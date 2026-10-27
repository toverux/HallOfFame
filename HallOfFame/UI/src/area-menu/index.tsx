/**
 * Extensions for menu UI components.
 */

import { AutoNavigationScope } from 'cs2/input';
import type { ModRegistrar } from 'cs2/modding';
import { CreatorDashboard } from '../components/creator-dashboard/creator-dashboard';
import * as bindings from '../utils/bindings';
import { MasterScreenPortal } from './master-screen-portal';
import { MenuSplashscreen } from './menu-splashscreen';

export const register: ModRegistrar = moduleRegistry => {
  moduleRegistry.extend(
    'game-ui/menu/components/menu-ui-backdrops/menu-ui-backdrops.tsx',
    'MenuUIBackdrops',
    MenuUIBackdrops => props => {
      const isSlideshowEnabled = bindings.useIsSlideshowEnabled();

      return isSlideshowEnabled ? <></> : <MenuUIBackdrops {...props} />;
    }
  );

  moduleRegistry.extend('game-ui/menu/components/menu-ui.tsx', 'MenuUI', COMenuUI => props => {
    const isSlideshowEnabled = bindings.useIsSlideshowEnabled();

    // The dashboard outside the slideshow, which the settings can turn off, and outside the
    // master screen, which the options page replaces: the options' button opens it too.
    // The menu sits in a focus controller hosting a single child, so the two share a scope that
    // takes the menu's place there.
    return (
      <>
        {isSlideshowEnabled && <MenuSplashscreen />}
        <AutoNavigationScope>
          <COMenuUI {...props} />
          <CreatorDashboard />
        </AutoNavigationScope>
      </>
    );
  });

  moduleRegistry.extend(
    'game-ui/menu/components/shared/master-screen/master-screen.tsx',
    'MasterScreen',
    COMasterScreen => props => {
      const isSlideshowEnabled = bindings.useIsSlideshowEnabled();

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
