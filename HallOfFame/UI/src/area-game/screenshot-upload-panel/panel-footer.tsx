import classNames from 'classnames';
import { useLocalization } from 'cs2/l10n';
import { Button, Icon } from 'cs2/ui';
import { memo, type ReactElement, useCallback } from 'react';
import * as bindings from '../../bindings';
// biome-ignore lint/correctness/noPrivateImports: svgs don't have @public annotations
import cloudArrowUpSolidSrc from '../../icons/fontawesome/cloud-arrow-up-solid.svg';
import type { DraggableProps } from '../../utils';
import { buildUploadPayload, type ScreenshotInfoFormValue } from './form-state';
import * as styles from './panel-footer.module.scss';

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

  // Showcasing an asset requires picking one; without it there is nothing valid to upload.
  const isShowcaseSelectionMissing = formValue.isShowcasingAsset && !formValue.showcasedMod;

  return (
    <div className={styles.footer} {...draggable}>
      {isIdleOrUploading && (
        <>
          {!isUploading && (
            <Button
              className={classNames(styles.footerButton, styles.footerButtonCancel)}
              variant='primary'
              disabled={isUploading}
              onSelect={bindings.clearScreenshot}
              selectSound='close-panel'>
              {translate('Common.ACTION[Cancel]', 'Cancel')}
            </Button>
          )}

          <Button
            variant='primary'
            className={styles.footerButton}
            disabled={creatorNameIsEmpty || isUploading || isShowcaseSelectionMissing}
            onSelect={handleUpload}>
            <Icon src={cloudArrowUpSolidSrc} tinted={true} className={styles.footerButtonIcon} />

            {isUploading
              ? translate('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOADING')
              : translate('HallOfFame.UI.Game.ScreenshotUploadPanel.SHARE')}
          </Button>
        </>
      )}

      {isDoneUploading && (
        <Button
          variant='primary'
          className={styles.footerButton}
          onSelect={bindings.clearScreenshot}
          selectSound='close-menu'>
          {translate('Common.CLOSE', 'Close')}
        </Button>
      )}
    </div>
  );
});

/**
 * Builds the upload payload from the form state and submits it through the capture facade.
 * Does nothing when {@link buildUploadPayload} returns `undefined` (the user opted to showcase an
 * asset but did not pick one).
 */
function submitUpload(formValue: ScreenshotInfoFormValue): void {
  const payload = buildUploadPayload(formValue);

  if (payload) {
    bindings.uploadScreenshot(payload);
  }
}
