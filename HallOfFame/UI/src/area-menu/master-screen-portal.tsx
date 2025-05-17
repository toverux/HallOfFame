import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getClassesModule, logError, selector } from '../utils';
import { MenuControls } from './menu-controls';
import { useHofMenuState } from './menu-state-hook';

const coFpsDisplayStyles = getClassesModule(
  'game-ui/debug/components/fps-display/fps-display.module.scss',
  ['fpsDisplay']
);

const coMenuUiStyles = getClassesModule('game-ui/menu/components/menu-ui.module.scss', [
  'corner',
  'menuUi',
  'version'
]);

const coMainMenuScreenStyles = getClassesModule(
  'game-ui/menu/components/main-menu-screen/main-menu-screen.module.scss',
  ['column', 'logo']
);

interface Props {
  readonly children: ReactNode;
}

/**
 * This component wraps the "master screen", which is the main menu screen you see when opening the
 * game or pausing.
 * It borrows its life cycle to install a portal which patches its DOM to install the menu
 * screenshot controls, only when not in game, where we let the translucent overlay with your city
 * behind.
 * It also handles toggling the game UI (except our controls).
 */
export function MasterScreenPortal({ children }: Props): ReactNode {
  const [menuState] = useHofMenuState();

  const [portalTargetEl, setPortalTargetEl] = useState<Element>();

  const menuControlsColumn = useRef<Element>();

  // Finds the first column div in the Master Screen (when not in pause mode) and mounts the menu
  // controls portal there.
  useEffect(() => {
    const menuUiSelector = selector(coMenuUiStyles.menuUi);
    const menuUiEl = document.querySelector(menuUiSelector);

    // We this element does not exist, we are in-game with the pause menu, we don't display a
    // background image here, so bail out.
    // Yes, there's no vanilla binding to check if we're in-game (well, there is something similar,
    // but the main screen menu being displayed in game or not is the same state), we could set one
    // up, but this is quicker and is very likely robust enough.
    if (!(menuUiEl instanceof Element)) {
      return;
    }

    const columnSelector = `${menuUiSelector} ${selector(coMainMenuScreenStyles.column)}`;

    menuControlsColumn.current = document.querySelector(columnSelector) ?? undefined;

    if (!(menuControlsColumn.current instanceof HTMLElement)) {
      return logError(
        new Error(
          `Could not locate Master Screen's first column div (using selector "${columnSelector}")`
        )
      );
    }

    menuControlsColumn.current.style.justifyContent = 'flex-end';

    setPortalTargetEl(menuControlsColumn.current);
  }, []);

  // Handles menu visibility.
  useEffect(() => {
    // Ignore if we're not set up in this menu.
    if (!menuControlsColumn.current) {
      return;
    }

    const elementsToHide = document.querySelectorAll(
      [
        selector(coFpsDisplayStyles.fpsDisplay),
        selector(coMainMenuScreenStyles.column),
        selector(coMainMenuScreenStyles.logo),
        selector(coMenuUiStyles.corner),
        selector(coMenuUiStyles.version)
      ].join(',')
    );

    // Hide all columns except the one with the menu controls.
    const visibility = menuState.isMenuVisible ? 'visible' : 'hidden';

    for (const element of elementsToHide) {
      if (element != menuControlsColumn.current) {
        (element as HTMLElement).style.visibility = visibility;
      }
    }
  }, [menuState.isMenuVisible]);

  return (
    <>
      {children}
      {portalTargetEl && createPortal(<MenuControls />, portalTargetEl)}
    </>
  );
}
