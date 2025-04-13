import { stripIndent } from 'common-tags';
import { type ReactElement, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getClassesModule, logError, selector } from '../utils';
import { ScreenshotUploadPanel } from './screenshot-upload-panel';

const coMainScreenStyles = getClassesModule(
  'game-ui/game/components/game-main-screen.module.scss',
  ['mainContainer']
);

/**
 * This component is added to the main game UI, but does not add content
 * directly. Instead, it borrows its lifecycle to then create a React Portal
 * that will be inserted in the main-container element, rendering the screenshot
 * upload panel.
 * The main-container element is where the base game big panels are rendered, so
 * that's why we want to mimic that behavior and target that precise element,
 * which is not directly exposed as a module.
 */
export function GameMainContainerPortal(): ReactElement {
  const [portalTargetEl, setPortalTargetEl] = useState<Element>();

  // This will be executed once when our host is ready, i.e. when the
  // .main-container has been created in the DOM.
  useEffect(() => {
    const mainContainerSelector = selector(coMainScreenStyles.mainContainer);

    const mainContainerEl = document.querySelector(mainContainerSelector);

    if (!(mainContainerEl instanceof Element)) {
      return logError(
        new Error(stripIndent`
                    Could not locate Main Container div
                    (using selector "${mainContainerSelector}")`)
      );
    }

    setPortalTargetEl(mainContainerEl);
  }, []);

  return portalTargetEl ? createPortal(<ScreenshotUploadPanel />, portalTargetEl) : <></>;
}
