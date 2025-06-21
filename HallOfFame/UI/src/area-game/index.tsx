/**
 * Extensions for in-game UI components.
 */

import type { ModRegistrar } from 'cs2/modding';
import { PhotoModePanelPortal } from './photo-mode-panel-portal';
import { ScreenshotUploadPanel } from './screenshot-upload-panel';

export const register: ModRegistrar = moduleRegistry => {
  moduleRegistry.append('Game', ScreenshotUploadPanel);

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
