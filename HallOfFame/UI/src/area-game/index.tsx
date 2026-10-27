/**
 * Extensions for in-game UI components.
 */

import type { ModRegistrar } from 'cs2/modding';
import { CreatorDashboard } from '../components/creator-dashboard/creator-dashboard';
import { PhotoModePanelPortal } from './photo-mode-panel-portal';
import { ScreenshotUploadPanel } from './screenshot-upload-panel';
import { UniversalModMenuButton } from './universal-mod-menu-button';

export const register: ModRegistrar = moduleRegistry => {
  moduleRegistry.append('Game', ScreenshotUploadPanel);
  // A function rather than the memoized component itself: `append` takes any other value for a
  // module name, and throws on finding no module by that name.
  moduleRegistry.append('Game', () => <CreatorDashboard />);
  moduleRegistry.append('UniversalModMenu', UniversalModMenuButton);

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
