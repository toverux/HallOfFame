import { stripIndent } from 'common-tags';
import { bindValue, useValue } from 'cs2/api';
import { type ReactNode, useEffect } from 'react';
import type { Screenshot } from '../common';
import { getClassesModule, logError, selector, useModSettings } from '../utils';

const logoScreenStyles = getClassesModule('game-ui/overlay/logo-screen/logo-screen.module.scss', [
  'logoScreen'
]);

const screenshot$ = bindValue<Screenshot | null>('hallOfFame.presenter', 'screenshot', null);

interface Props {
  readonly children: ReactNode;
}

/**
 * This component wraps the loading screen overlay (the one with a spinner and
 * the gameplay hints), and changes its background image with the latest image
 * HoF loaded, if any, otherwise leaves it untouched.
 */
export function LogoScreenWrapper({ children }: Props): ReactNode {
  const settings = useModSettings();
  const screenshot = useValue(screenshot$);

  // When the component is mounted, immediately apply the new background.
  // biome-ignore lint/correctness/useExhaustiveDependencies: no need to run more than once
  useEffect(() => {
    if (!screenshot) {
      return;
    }

    const imageUrl =
      settings.screenshotResolution == 'fhd' ? screenshot.imageUrlFHD : screenshot.imageUrl4K;

    const logoScreenEl = document.querySelector(selector(logoScreenStyles.logoScreen));

    if (!(logoScreenEl instanceof HTMLElement)) {
      return logError(
        new Error(stripIndent`
                    Could not locate loading screen element
                    (using selector "${logoScreenEl}")`)
      );
    }

    logoScreenEl.style.backgroundImage = `url(${imageUrl})`;
  }, []);

  // Passthrough content.
  return children;
}
