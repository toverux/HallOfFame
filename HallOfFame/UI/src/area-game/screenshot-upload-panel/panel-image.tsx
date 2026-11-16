import classNames from 'classnames';
import { Button } from 'cs2/ui';
import {
  type CSSProperties,
  memo,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { FullscreenImage } from '../../components/fullscreen-image';
import { PreloadImages } from '../../components/preload-images';
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

    const [isMaximized, setIsMaximized] = useState(false);

    const maximize = useCallback(() => {
      setIsMaximized(true);
    }, []);

    const unmaximize = useCallback(() => {
      setIsMaximized(false);
    }, []);

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

        <PreviewImage
          key={screenshotSnapshot.previewImageUri}
          uri={screenshotSnapshot.previewImageUri}
          // On the preview, not on this whole block: React bubbles a click through the portal along
          // the component tree, so the click closing the maximized image would reopen it here.
          {...(screenshotSnapshot.isImageReady && { onClick: maximize })}
        />

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
              {/* oxlint-disable-next-line react/jsx-no-literals - typographic symbol, not translatable */}
              16:9
            </div>
          </Tooltip>
        )}

        <Tooltip tooltip={translate('HallOfFame.UI.Game.ScreenshotUploadPanel.MAXIMIZE_TOOLTIP')}>
          <Button
            variant='round'
            src={expandSolidSrc}
            tinted={true}
            // The full image still encodes when the panel opens on the preview.
            disabled={!screenshotSnapshot.isImageReady}
            selectSound='open-panel'
            onSelect={maximize}
            className={classNames(styles.imageMagnifyButton, {
              [styles.imageHidden]: uploadProgress != null
            })}
          />
        </Tooltip>

        {/* Loaded while the creator reads the panel, so a maximize shows it whole at once. */}
        <PreloadImages
          srcs={screenshotSnapshot.isImageReady ? [screenshotSnapshot.imageUri] : []}
        />

        {isMaximized && (
          <FullscreenImage
            src={screenshotSnapshot.imageUri}
            placeholderSrc={screenshotSnapshot.previewImageUri}
            onClose={unmaximize}
          />
        )}
      </div>
    );
  }
);

/**
 * The capture's preview, a live texture the mod destroys only once the UI lets go of it: an `<img>`
 * holds it until garbage collection, minutes away while the UI idles, so it clears its source on
 * unmount.
 */
function PreviewImage({
  uri,
  onClick
}: Readonly<{ uri: string; onClick?: () => void }>): ReactElement {
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = imageRef.current;

    return () => {
      if (image) {
        image.src = '';
      }
    };
  }, []);

  // noinspection HtmlRequiredAltAttribute
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions - a mouse shortcut to the maximize button, which keyboard and gamepad reach
    <img
      ref={imageRef}
      className={classNames(styles.imagePreview, coFixedRatioImageStyles.image)}
      src={uri}
      onClick={onClick}
    />
  );
}
