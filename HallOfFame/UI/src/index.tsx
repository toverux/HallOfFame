import { ModRegistrar } from 'cs2/modding';
import registerOnGame from './game';
import registerOnMenu from './menu';

const register: ModRegistrar = moduleRegistry => {
    // @todo For debug, remove on release.
    (window as any).reg = moduleRegistry;

    registerOnMenu(moduleRegistry);
    registerOnGame(moduleRegistry);

    console.info(`HoF: Successfully registered all modules.`);
};

export default register;
