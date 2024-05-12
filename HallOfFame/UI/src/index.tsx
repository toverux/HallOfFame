import { ModRegistrar } from 'cs2/modding';
import registerMenuSplashscreen from './menu-splashscreen';

const register: ModRegistrar = moduleRegistry => {
    // @todo For debug, remove on release.
    (window as any).reg = moduleRegistry;

    registerMenuSplashscreen(moduleRegistry);

    console.info(`HoF: Successfully registered all modules.`)
};

export default register;
