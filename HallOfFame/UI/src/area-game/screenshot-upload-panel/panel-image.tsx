import classNames from 'classnames';
import { useLocalization } from 'cs2/l10n';
import { Button, Tooltip } from 'cs2/ui';
import { type CSSProperties, memo, type ReactElement, useCallback, useMemo } from 'react';
import type * as bindings from '../../bindings';
import { getClassesModule } from '../../utils';
import { DescriptionTooltip } from '../../vanilla-modules/game-ui/common/tooltip/description-tooltip/description-tooltip';
import * as styles from './screenshot-upload-panel.module.scss';
import { getRatioPreviewInfo } from './screenshot-upload-panel-utils';

const coFixedRatioImageStyles = getClassesModule(
  'game-ui/common/image/fixed-ratio-image.module.scss',
  ['fixedRatioImage', 'image', 'ratio']
);

export const ScreenshotUploadPanelImage = memo(function ScreenshotUploadPanelImageBase({
  screenshotSnapshot,
  uploadProgress
}: Readonly<{
  screenshotSnapshot: bindings.JsonScreenshotSnapshot;
  uploadProgress: bindings.JsonUploadProgress | null;
}>): ReactElement {
  const { translate } = useLocalization();

  const ratioPreviewInfo = useMemo(
    () => getRatioPreviewInfo(screenshotSnapshot),
    [screenshotSnapshot]
  );

  const showImageFullscreen = useCallback(
    () => showFullscreenImage(screenshotSnapshot.imageUri),
    [screenshotSnapshot.imageUri]
  );

  // noinspection HtmlRequiredAltAttribute
  return (
    <div
      className={classNames(
        styles.screenshotUploadPanelImage,
        coFixedRatioImageStyles.fixedRatioImage
      )}
      style={
        {
          '--w': screenshotSnapshot.imageWidth,
          '--h': screenshotSnapshot.imageHeight
        } as CSSProperties
      }>
      {/* This div sets the size of its parent and therefore the size of the image. */}
      <div className={coFixedRatioImageStyles.ratio} />

      <img className={coFixedRatioImageStyles.image} src={screenshotSnapshot.previewImageUri} />

      {ratioPreviewInfo.type != 'equal' && (
        <DescriptionTooltip
          direction='down'
          title={translate('HallOfFame.UI.Game.ScreenshotUploadPanel.ASPECT_RATIO_TOOLTIP_TITLE')}
          description={translate(
            'HallOfFame.UI.Game.ScreenshotUploadPanel.ASPECT_RATIO_TOOLTIP_DESCRIPTION'
          )}>
          <div
            className={classNames(styles.screenshotUploadPanelImageRatioPreview, {
              [styles.screenshotUploadPanelImageHidden]: uploadProgress != null
            })}
            style={ratioPreviewInfo.style}>
            {/** biome-ignore lint/style/noJsxLiterals: no need to translate this */}
            16:9
          </div>
        </DescriptionTooltip>
      )}

      <Tooltip tooltip={translate('HallOfFame.UI.Game.ScreenshotUploadPanel.MAXIMIZE_TOOLTIP')}>
        <Button
          variant='round'
          selectSound='open-panel'
          onSelect={showImageFullscreen}
          className={classNames(styles.screenshotUploadPanelImageMagnifyButton, {
            [styles.screenshotUploadPanelImageHidden]: uploadProgress != null
          })}>
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'>
            {/* Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc. */}
            <path d='M32 32C14.3 32 0 46.3 0 64l0 96c0 17.7 14.3 32 32 32s32-14.3 32-32l0-64 64 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 96c0 17.7 14.3 32 32 32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0 0-64zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32l64 0 0 64c0 17.7 14.3 32 32 32s32-14.3 32-32l0-96c0-17.7-14.3-32-32-32l-96 0zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 64-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c17.7 0 32-14.3 32-32l0-96z' />
          </svg>
        </Button>
      </Tooltip>
    </div>
  );
});

function showFullscreenImage(src: string): void {
  const div = document.createElement('div');

  div.classList.add(styles.fullscreenImage);
  div.style.backgroundImage = `url(${src})`;

  document.body.appendChild(div);

  div.addEventListener('click', () => {
    document.body.removeChild(div);
  });
}
