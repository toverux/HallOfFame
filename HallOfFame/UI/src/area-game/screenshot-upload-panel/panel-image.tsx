import classNames from 'classnames';
import { Button } from 'cs2/ui';
import { type CSSProperties, memo, type ReactElement, useCallback, useMemo } from 'react';
import { Tooltip } from '../../components/tooltip';
import expandSolidSrc from '../../icons/fontawesome/expand-solid.svg';
import { getClassesModule, useTranslate } from '../../utils';
import type * as bindings from '../../utils/bindings';
import { TooltipLayout } from '../../vanilla-modules/game-ui/common/tooltip/description-tooltip/description-tooltip';
import { getRatioPreviewInfo } from './screenshot-upload-panel-utils';
import * as styles from './panel-image.module.scss';

const coFixedRatioImageStyles = getClassesModule(
  'game-ui/common/image/fixed-ratio-image.module.scss',
  ['fixedRatioImage', 'image', 'ratio']
);

export const ScreenshotUploadPanelImage = memo(
  ({
    screenshotSnapshot,
    uploadProgress
  }: Readonly<{
    screenshotSnapshot: bindings.JsonScreenshotSnapshot;
    uploadProgress: bindings.JsonUploadProgress | null;
  }>): ReactElement => {
    const translate = useTranslate();

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
        className={classNames(styles.image, coFixedRatioImageStyles.fixedRatioImage)}
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
          <Tooltip
            direction='down'
            tooltip={
              <TooltipLayout
                title={translate(
                  'HallOfFame.UI.Game.ScreenshotUploadPanel.ASPECT_RATIO_TOOLTIP_TITLE'
                )}
                description={translate(
                  'HallOfFame.UI.Game.ScreenshotUploadPanel.ASPECT_RATIO_TOOLTIP_DESCRIPTION'
                )}
              />
            }>
            <div
              className={classNames(styles.imageRatioPreview, {
                [styles.imageHidden]: uploadProgress != null
              })}
              style={ratioPreviewInfo.style}>
              16:9
            </div>
          </Tooltip>
        )}

        <Tooltip tooltip={translate('HallOfFame.UI.Game.ScreenshotUploadPanel.MAXIMIZE_TOOLTIP')}>
          <Button
            variant='round'
            src={expandSolidSrc}
            tinted={true}
            selectSound='open-panel'
            onSelect={showImageFullscreen}
            className={classNames(styles.imageMagnifyButton, {
              [styles.imageHidden]: uploadProgress != null
            })}
          />
        </Tooltip>
      </div>
    );
  }
);

function showFullscreenImage(src: string): void {
  const div = document.createElement('div');

  div.classList.add(styles.fullscreenImage);
  div.style.backgroundImage = `url(${src})`;

  document.body.appendChild(div);

  div.addEventListener('click', () => {
    document.body.removeChild(div);
  });
}
