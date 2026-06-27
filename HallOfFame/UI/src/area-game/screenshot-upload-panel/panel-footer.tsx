import classNames from 'classnames';
import { useLocalization } from 'cs2/l10n';
import { Button, Icon } from 'cs2/ui';
import { memo, type ReactElement, useCallback } from 'react';
import * as bindings from '../../bindings';
// biome-ignore lint/correctness/noPrivateImports: svgs don't have @public annotations
import cloudArrowUpSolidSrc from '../../icons/fontawesome/cloud-arrow-up-solid.svg';
import type { DraggableProps } from '../../utils';
import type { ScreenshotInfoFormValue } from './form-state';
import * as styles from './screenshot-upload-panel.module.scss';

export const ScreenshotUploadPanelFooter = memo(function ScreenshotUploadPanelFooterBase({
  creatorNameIsEmpty,
  uploadProgress,
  draggable,
  formValue
}: Readonly<{
  creatorNameIsEmpty: boolean;
  uploadProgress: bindings.JsonUploadProgress | null;
  draggable: DraggableProps;
  formValue: ScreenshotInfoFormValue;
}>): ReactElement {
  const { translate } = useLocalization();

  const handleUpload = useCallback(() => submitUpload(formValue), [formValue]);

  const isUploading = uploadProgress != null && !uploadProgress.isComplete;
  const isIdleOrUploading = !uploadProgress?.isComplete;
  const isDoneUploading = uploadProgress?.isComplete == true;

  return (
    <div className={styles.screenshotUploadPanelFooter} {...draggable}>
      {isIdleOrUploading && (
        <>
          {!isUploading && (
            <Button
              className={classNames(
                styles.screenshotUploadPanelFooterButton,
                styles.screenshotUploadPanelFooterButtonCancel
              )}
              variant='primary'
              disabled={isUploading}
              onSelect={bindings.clearScreenshot}
              selectSound='close-panel'>
              {translate('Common.ACTION[Cancel]', 'Cancel')}
            </Button>
          )}

          <Button
            variant='primary'
            className={styles.screenshotUploadPanelFooterButton}
            disabled={creatorNameIsEmpty || isUploading}
            onSelect={handleUpload}>
            <Icon
              src={cloudArrowUpSolidSrc}
              tinted={true}
              className={styles.screenshotUploadPanelFooterButtonIcon}
            />

            {isUploading
              ? translate('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOADING')
              : translate('HallOfFame.UI.Game.ScreenshotUploadPanel.SHARE')}
          </Button>
        </>
      )}

      {isDoneUploading && (
        <Button
          variant='primary'
          className={styles.screenshotUploadPanelFooterButton}
          onSelect={bindings.clearScreenshot}
          selectSound='close-menu'>
          {translate('Common.CLOSE', 'Close')}
        </Button>
      )}
    </div>
  );
});

/**
 * Validates the form state and maps it to the {@link bindings.UploadPayload} the capture facade
 * expects, then submits it. Bails out silently if the user opted to showcase an asset but did not
 * pick one.
 */
function submitUpload(formValue: ScreenshotInfoFormValue): void {
  if (formValue.isShowcasingAsset && !formValue.showcasedMod) {
    return;
  }

  const payload: bindings.UploadPayload = {
    shareModIds: formValue.shareModIds,
    shareRenderSettings: formValue.shareRenderSettings,
    showcasedModId:
      formValue.isShowcasingAsset && formValue.showcasedMod ? formValue.showcasedMod.id : null,
    description: formValue.description.trim() || null
  };

  bindings.uploadScreenshot(payload);
}
