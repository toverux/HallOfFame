import type { ModRegistrar } from 'cs2/modding';
import { register as registerOnGame } from './game';
import { register as registerOnMenu } from './menu';
import { register as registerOnOverlay } from './overlay';
import { logError } from './utils';

const register: ModRegistrar = moduleRegistry => {
    try {
        registerOnMenu(moduleRegistry);
        registerOnGame(moduleRegistry);
        registerOnOverlay(moduleRegistry);
    } catch (error) {
        return logError(error, true);
    }

    console.info(`HoF: Successfully registered all modules.`);
};

// noinspection JSUnusedGlobalSymbols
export const hasCSS = true;

// biome-ignore lint/style/noDefaultExport: this is per contract the main entry point of the mod.
export default register;
