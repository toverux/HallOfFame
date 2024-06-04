import { stripIndent } from 'common-tags';
import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { classNamesToSelector, getClassesModule, logError } from '../common';
import { MenuControls } from './menu-controls';

const menuUiStyles = getClassesModule(
    'game-ui/menu/components/menu-ui.module.scss',
    ['menuUi']
);

const coMainMenuScreenStyles = getClassesModule(
    'game-ui/menu/components/main-menu-screen/main-menu-screen.module.scss',
    ['column']
);

interface Props {
    readonly children: ReactNode;
}

/**
 * This component wraps the "master screen", which is the main menu screen you
 * see when opening the game or pausing.
 * It borrows its life cycle to install a portal which patches its DOM to
 * install the menu screenshot controls, only when not in game, where we let
 * the translucent overlay with your city behind.
 */
export function MasterScreenPortal({ children }: Props): ReactNode {
    const [portalTargetEl, setPortalTargetEl] = useState<Element>();

    useEffect(() => {
        const menuUiSelector = classNamesToSelector(menuUiStyles.menuUi);
        const menuUiEl = document.querySelector(menuUiSelector);

        // We this element does not exist, we are in-game with the pause menu,
        // we don't display a background image here, so bail out.
        // Yes, there's no vanilla binding to check if we're in-game (well there
        // is something similar, but the main screen menu being displayed in
        // game or not is the same state), we could set up one but this is
        // quicker and is very likely robust enough.
        if (!(menuUiEl instanceof Element)) {
            return;
        }

        const columnSelector = `${menuUiSelector} .${coMainMenuScreenStyles.column}`;
        const firstColumnEl = document.querySelector(columnSelector);

        if (!(firstColumnEl instanceof HTMLElement)) {
            return logError(
                new Error(stripIndent`
                    Could not locate Master Screen's first column div
                    (using selector "${columnSelector}")`)
            );
        }

        firstColumnEl.style.justifyContent = 'flex-end';

        setPortalTargetEl(firstColumnEl);
    }, []);

    return (
        <>
            {children}
            {portalTargetEl && createPortal(<MenuControls />, portalTargetEl)}
        </>
    );
}
