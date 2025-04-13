/**
 * Extensions for in-game UI components.
 */

import type { ModRegistrar } from 'cs2/modding';
import { GameMainContainerPortal } from './game-main-container-portal';
import { PhotoModePanelPortal } from './photo-mode-panel-portal';

export const register: ModRegistrar = moduleRegistry => {
  moduleRegistry.append('Game', GameMainContainerPortal);

  moduleRegistry.extend(
    'game-ui/game/components/photo-mode/photo-mode-panel.tsx',
    'PhotoModePanel',
    COPanel => props => (
      <PhotoModePanelPortal>
        <COPanel {...props} />
      </PhotoModePanelPortal>
    )
  );
};
