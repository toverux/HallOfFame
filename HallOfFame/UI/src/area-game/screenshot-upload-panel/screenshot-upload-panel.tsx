import classNames from 'classnames';
import { type ReactElement, useEffect, useRef } from 'react';
import { useSetState } from 'react-use';
import { preloadImage as defaultPreloadImage, useDraggable } from '../../utils';
import * as bindings from '../../utils/bindings';
import { useCaptureRevealGate } from './capture-reveal-gate';
import type { ScreenshotInfoFormValue } from './form-state';
import { ScreenshotUploadPanelContentCityInfo } from './panel-city-info';
import { ScreenshotUploadPanelFooter } from './panel-footer';
import { ScreenshotUploadPanelHeader } from './panel-header';
import { ScreenshotUploadPanelImage } from './panel-image';
import { ScreenshotUploadPanelContentScreenshotInfo } from './panel-info-form';
import * as styles from './screenshot-upload-panel.module.scss';
import * as shared from './shared.module.scss';
import { ScreenshotUploadProgress } from './upload-progress';

interface ScreenshotUploadPanelProps {
  /**
   * Preview-image preloader seam.
   * Injectable so tests can drive the reveal deterministically; defaults to the real Cohtml-backed
   * {@link defaultPreloadImage}.
   */
  readonly preloadImage?: (url: string) => Promise<void>;
}

/**
 * Component that shows up when the user takes a HoF screenshot.
 *
 * Its reveal is gated behind preloading the preview image: the panel plays an entrance animation,
 * and decoding a large preview mid-animation stutters, so it stays unmounted until the preview is
 * decoded, then reveals (animation runs against an already-decoded image) and plays the shutter
 * sound.
 */
export function ScreenshotUploadPanel({
  preloadImage = defaultPreloadImage
}: ScreenshotUploadPanelProps): ReactElement {
  const settings = bindings.useModSettings();
  const uploadFormMemory = bindings.useUploadFormMemory();

  const panelRef = useRef<HTMLDivElement>(null);
  const draggable = useDraggable(panelRef);

  const screenshotSnapshot = bindings.useScreenshotSnapshot();
  const uploadProgress = bindings.useUploadProgress();

  const previewImageUri = screenshotSnapshot ? screenshotSnapshot.previewImageUri : null;

  const isRevealed = useCaptureRevealGate(previewImageUri, preloadImage);

  const originalFormState: ScreenshotInfoFormValue = {
    shareModIds: uploadFormMemory.shareModIds,
    shareRenderSettings: uploadFormMemory.shareRenderSettings,
    isShowcasingAsset: false,
    showcasedMod: undefined,
    // A button under the textarea allows the user to restore from `uploadFormMemory.description`.
    description: ''
  };

  const [formValue, patchFormValue] = useSetState<ScreenshotInfoFormValue>(originalFormState);

  // Reset the form whenever a new screenshot is captured.
  useEffect(() => {
    if (screenshotSnapshot) {
      patchFormValue(originalFormState);
    }
  }, [screenshotSnapshot]);

  // Show the panel only once there is a screenshot and its preview image has been decoded.
  if (!(screenshotSnapshot && isRevealed)) {
    // biome-ignore lint/complexity/noUselessFragments: we need to return a ReactElement.
    return <></>;
  }

  const creatorNameIsEmpty = !settings.creatorName.trim();

  return (
    <div className={styles.panelContainer}>
      <div ref={panelRef} className={classNames(styles.panel, shared.scrollableTrackCustomization)}>
        <ScreenshotUploadPanelHeader
          screenshotSnapshot={screenshotSnapshot}
          draggable={draggable}
        />

        <div className={styles.panelPanes}>
          {uploadProgress && <ScreenshotUploadProgress uploadProgress={uploadProgress} />}

          <div className={styles.panelPanesImage}>
            <ScreenshotUploadPanelImage
              screenshotSnapshot={screenshotSnapshot}
              uploadProgress={uploadProgress}
            />

            <ScreenshotUploadPanelContentCityInfo
              settings={settings}
              screenshotSnapshot={screenshotSnapshot}
              creatorNameIsEmpty={creatorNameIsEmpty}
            />
          </div>

          <div className={classNames(styles.panelPanesInfo, shared.panelSurface)}>
            <ScreenshotUploadPanelContentScreenshotInfo
              creatorNameIsEmpty={creatorNameIsEmpty}
              screenshotSnapshot={screenshotSnapshot}
              formValue={formValue}
              patchFormValue={patchFormValue}
            />
          </div>
        </div>

        <ScreenshotUploadPanelFooter
          creatorNameIsEmpty={creatorNameIsEmpty}
          uploadProgress={uploadProgress}
          draggable={draggable}
          formValue={formValue}
        />
      </div>
    </div>
  );
}
