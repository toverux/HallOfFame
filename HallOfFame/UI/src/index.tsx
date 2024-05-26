import type { ModRegistrar } from 'cs2/modding';
import { register as registerOnGame } from './game';
import { register as registerOnMenu } from './menu';
import { register as registerOnTimeControls } from './time-controls';

const register: ModRegistrar = moduleRegistry => {
    // @todo For debug, remove on release.
    // biome-ignore lint/suspicious/noExplicitAny: todo
    (window as any).reg = moduleRegistry;

    registerOnMenu(moduleRegistry);
    registerOnGame(moduleRegistry);
    registerOnTimeControls(moduleRegistry);

    console.info(`HoF: Successfully registered all modules.`);
};

// biome-ignore lint/style/noDefaultExport: this is per contract the main entry point of the mod.
export default register;
