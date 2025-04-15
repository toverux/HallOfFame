import type { ModRegistrar } from 'cs2/modding';
import { register as registerOnGame } from './area-game';
import { register as registerOnMenu } from './area-menu';
import { register as registerOnOverlay } from './area-overlay';
import { logError } from './utils';

// Bundle icon in the build to be used by the C# backend.
// coui://ui-mods/images/stats-notification.svg
import './icons/stats-notification.svg';

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
