import { ModRegistrar } from 'cs2/modding';
import { MenuButton } from 'cs2/ui';
import { useState } from 'react';

const register: ModRegistrar = (moduleRegistry) => {
    function CustomMenuButton() {
        const [counter, setCounter] = useState(0);

        function click() {
            setCounter(count => count + 1);

            console.log(moduleRegistry.registry);
        }

        return <MenuButton onSelect={click}>
            <img src="https://secure.gravatar.com/avatar/b57db47bc0d36d4e08e35d83d9516814" />
            {counter}
        </MenuButton>;
    }

    // Search the module registry for buttons and log to console
    console.log('Registry', moduleRegistry.registry);

    // append(modulePath, exportName, Component)
    moduleRegistry.append(
        'game-ui/menu/components/main-menu-screen/main-menu-screen.tsx',
        'MainMenuNavigation',
        CustomMenuButton);
};

export default register;
