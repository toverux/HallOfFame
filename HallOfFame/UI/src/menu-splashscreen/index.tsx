import { ModRegistrar, ModuleRegistryExtend } from 'cs2/modding';
import { MenuSplashscreen } from './menu-splashscreen';
import styles from './menu-splashscreen.module.scss';

const MenuUIExtension: ModuleRegistryExtend = Component => props => <>
    <MenuSplashscreen/>
    <Component {...props} />
</>;

const registerMenuSplashscreen: ModRegistrar = moduleRegistry => {
    moduleRegistry.extend('game-ui/menu/components/menu-ui.tsx', 'MenuUI', MenuUIExtension);
    moduleRegistry.extend('game-ui/menu/components/menu-ui.module.scss', styles);

    console.info(`HoF: Successfully registered MenuSplashscreen.`);
};

export default registerMenuSplashscreen;
