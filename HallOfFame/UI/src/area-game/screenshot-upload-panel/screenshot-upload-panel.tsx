import classNames from 'classnames';
import { type ReactElement, useEffect, useRef } from 'react';
import { useSetState } from 'react-use';
import { useDraggable } from '../../utils';
import * as bindings from '../../utils/bindings';
import type { ScreenshotInfoFormValue } from './form-state';
import { ScreenshotUploadPanelContentCityInfo } from './panel-city-info';
import { ScreenshotUploadPanelFooter } from './panel-footer';
import { ScreenshotUploadPanelHeader } from './panel-header';
import { ScreenshotUploadPanelImage } from './panel-image';
import { ScreenshotUploadPanelContentScreenshotInfo } from './panel-info-form';
import * as styles from './screenshot-upload-panel.module.scss';
import * as shared from './shared.module.scss';
import { ScreenshotUploadProgress } from './upload-progress';

/**
 * Component that shows up when the user takes a HoF screenshot.
 */
export function ScreenshotUploadPanel(): ReactElement {
  const settings = bindings.useModSettings();

  const panelRef = useRef<HTMLDivElement>(null);
  const draggable = useDraggable(panelRef);

  const screenshotSnapshot = bindings.useScreenshotSnapshot();
  const uploadProgress = bindings.useUploadProgress();

  const originalFormState: ScreenshotInfoFormValue = {
    shareModIds: settings.savedShareModIdsPreference,
    shareRenderSettings: settings.savedShareRenderSettingsPreference,
    isShowcasingAsset: false,
    showcasedMod: undefined,
    // A button under the textarea allows the user to restore from `settings.savedDescription`
    description: ''
  };

  const [formValue, patchFormValue] = useSetState<ScreenshotInfoFormValue>(originalFormState);

  // Reset the form whenever a new screenshot is captured.
  useEffect(() => {
    if (screenshotSnapshot) {
      patchFormValue(originalFormState);
    }
  }, [screenshotSnapshot]);

  // Show the panel when there is a screenshot to upload.
  if (!screenshotSnapshot) {
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
              settings={settings}
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
