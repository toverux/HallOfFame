import { type ReactNode, useEffect } from 'react';
import * as bindings from '../bindings';
import { getClassesModule, logError, selector } from '../utils';

const logoScreenStyles = getClassesModule('game-ui/overlay/logo-screen/logo-screen.module.scss', [
  'logoScreen'
]);

interface Props {
  readonly children: ReactNode;
}

/**
 * This component wraps the loading screen overlay (the one with a spinner and the gameplay hints),
 * and changes its background image with the latest image HoF loaded, if any, otherwise leaves it
 * untouched.
 */
export function LogoScreenWrapper({ children }: Props): ReactNode {
  const settings = bindings.useModSettings();
  const screenshot = bindings.useScreenshot();

  // When the component is mounted, immediately apply the new background.
  useEffect(() => {
    const imageUrl = bindings.deriveImageUri(screenshot, settings);

    if (!imageUrl) {
      return;
    }

    const logoScreenEl = document.querySelector(selector(logoScreenStyles.logoScreen));

    if (!(logoScreenEl instanceof HTMLElement)) {
      return logError(
        new Error(`Could not locate loading screen element (using selector "${logoScreenEl}")`)
      );
    }

    logoScreenEl.style.backgroundImage = `url(${imageUrl})`;
  }, []);

  // Passthrough content.
  return children;
}
