import type { ModRegistrar } from 'cs2/modding';
import { logError } from './common';
import { register as registerOnGame } from './game';
import { register as registerOnMenu } from './menu';

const register: ModRegistrar = moduleRegistry => {
    // @todo For debug, remove on release.
    // biome-ignore lint/suspicious/noExplicitAny: todo
    (window as any).reg = moduleRegistry;

    try {
        registerOnMenu(moduleRegistry);
        registerOnGame(moduleRegistry);
    } catch (error) {
        return logError(error, true);
    }

    console.info(`HoF: Successfully registered all modules.`);
};

// biome-ignore lint/style/noDefaultExport: this is per contract the main entry point of the mod.
export default register;
