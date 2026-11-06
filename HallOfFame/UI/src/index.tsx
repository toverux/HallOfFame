import type { ModRegistrar } from 'cs2/modding';
import { register as registerOnGame } from './area-game';
import { register as registerOnMenu } from './area-menu';
import { register as registerOnOverlay } from './area-overlay';
import { iconsole } from './iconsole';
import { installKeepAliveImages } from './keep-alive-images';
import { logError } from './utils';
// Bundle icons in the build to be used by the C# backend.
// Ex. resulting URL: `coui://ui-mods/images/stats-notification.svg`
import './icons/stats-notification.svg';
import './icons/cs2-lightbulb.svg';

/**
 * The features registering on the game's UI, each on its own: one that throws is reported and
 * skipped, and the others still register.
 */
const registrars: readonly ModRegistrar[] = [
  registerOnMenu,
  registerOnGame,
  registerOnOverlay,
  // App-wide, not an area: the keep-alive nodes live on document.body outside the module registry,
  // so they persist across menu, sub-screen, and gameplay states.
  installKeepAliveImages
];

const register: ModRegistrar = moduleRegistry => {
  // The game calls every mod's registrar in one loop with no try/catch, so a throw here would also
  // keep every mod after this one from registering.
  let failed = false;

  for (const registrar of registrars) {
    try {
      registrar(moduleRegistry);
    } catch (error) {
      failed = true;

      logError(error, true);
    }
  }

  if (!failed) {
    iconsole.info(`HallOfFame: Registered all modules.`);
  }
};

// noinspection JSUnusedGlobalSymbols
export const hasCSS = true;

// oxlint-disable-next-line import/no-default-export - the game mod loader requires a default export
export default register;
