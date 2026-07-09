import { type ReactNode, useEffect } from 'react';
import { getClassesModule, logError, selector } from '../utils';
import * as bindings from '../utils/bindings';

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

    const logoScreenSelector = selector(logoScreenStyles.logoScreen);
    const logoScreenEl = document.querySelector(logoScreenSelector);

    if (!(logoScreenEl instanceof HTMLElement)) {
      return logError(
        new Error(
          `Could not locate loading screen element (using selector "${logoScreenSelector}")`
        )
      );
    }

    logoScreenEl.style.backgroundImage = `url(${imageUrl})`;
    // This effect is intentionally mount-only; screenshot and settings must not re-trigger it.
    // oxlint-disable-next-line react-hooks/exhaustive-deps - apply the background once on mount.
  }, []);

  // Passthrough content.
  return children;
}
