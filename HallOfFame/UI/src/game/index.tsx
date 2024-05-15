/**
 * Extensions for in-game UI components.
 */

import { ModRegistrar, ModuleRegistryExtend } from 'cs2/modding';
import { PhotoModePanelPatcher } from './photo-mode-panel-patcher';

const PhotoModePanelWatcherExtension: ModuleRegistryExtend = COPanel => props =>
    <PhotoModePanelPatcher>
        <COPanel {...props} />
    </PhotoModePanelPatcher>;

const register: ModRegistrar = moduleRegistry => {
    moduleRegistry.extend(
        'game-ui/game/components/photo-mode/photo-mode-panel.tsx',
        'PhotoModePanel',
        PhotoModePanelWatcherExtension);
};

export default register;
