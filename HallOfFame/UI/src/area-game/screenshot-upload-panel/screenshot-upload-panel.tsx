import classNames from 'classnames';
import { type ReactElement, useEffect, useRef } from 'react';
import { useSetState } from 'react-use';
import { useDraggable } from '../../utils';
import * as bindings from '../../utils/bindings';
import { useCaptureRevealGate } from './capture-reveal-gate';
import type { ScreenshotInfoFormValue } from './form-state';
import { ScreenshotUploadPanelContentCityInfo } from './panel-city-info';
import { ScreenshotUploadPanelFooter } from './panel-footer';
import { ScreenshotUploadPanelHeader } from './panel-header';
import { ScreenshotUploadPanelImage } from './panel-image';
import { ScreenshotUploadPanelContentScreenshotInfo } from './panel-info-form';
import { ScreenshotUploadProgress } from './upload-progress';
import * as formShared from '../../components/screenshot-form/shared.module.scss';
import * as styles from './screenshot-upload-panel.module.scss';
import * as shared from './shared.module.scss';

/**
 * Component that shows up when the user takes a HoF screenshot.
 *
 * Its reveal waits for the veil of the press to be gone, see {@link useCaptureRevealGate}.
 */
export function ScreenshotUploadPanel(): ReactElement {
  const settings = bindings.useModSettings();
  const uploadFormMemory = bindings.useUploadFormMemory();

  const panelRef = useRef<HTMLDivElement>(null);
  const draggable = useDraggable(panelRef);

  const screenshotSnapshot = bindings.useScreenshotSnapshot();
  const uploadProgress = bindings.useUploadProgress();

  const previewImageUri = screenshotSnapshot ? screenshotSnapshot.previewImageUri : null;

  const isRevealed = useCaptureRevealGate(previewImageUri);

  const originalFormState: ScreenshotInfoFormValue = {
    shareModIds: uploadFormMemory.shareModIds,
    shareRenderSettings: uploadFormMemory.shareRenderSettings,
    isShowcasingAsset: false,
    showcasedMod: undefined,
    // A button under the textarea allows the user to restore from `uploadFormMemory.description`.
    description: ''
  };

  const [formValue, patchFormValue] = useSetState<ScreenshotInfoFormValue>(originalFormState);

  // Reset the form whenever a new screenshot is captured, keyed on its preview, unique per capture:
  // the snapshot itself is published again when its full image turns ready.
  useEffect(() => {
    if (previewImageUri) {
      patchFormValue(originalFormState);
    }
    // Deps are intentionally narrow: originalFormState is recreated each render, so depending on it
    // (or patchFormValue) would reset the form on every render instead of only on a new capture.
    // oxlint-disable-next-line react-hooks/exhaustive-deps - reset only on a new capture.
  }, [previewImageUri]);

  // Show the panel only once there is a screenshot and its preview image has been decoded.
  if (!(screenshotSnapshot && isRevealed)) {
    return <></>;
  }

  const creatorNameIsEmpty = !settings.creatorName.trim();

  return (
    <div className={styles.panelContainer}>
      <div
        ref={panelRef}
        className={classNames(
          styles.panel,
          formShared.toneLight,
          formShared.scrollableTrackCustomization
        )}>
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
