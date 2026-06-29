import classNames from 'classnames';
import { useLocalization } from 'cs2/l10n';
import { memo, type ReactElement, useEffect } from 'react';
import { createSingletonHook, getClassesModule } from '../../utils';
import type * as bindings from '../../utils/bindings';
import {
  LoadingProgress,
  loadingProgressVanillaProps
} from '../../vanilla-modules/game-ui/overlay/logo-screen/loading/loading-progress';
import { getUploadProgressHintText } from './screenshot-upload-panel-utils';
import * as styles from './upload-progress.module.scss';

const coLoadingStyles = getClassesModule(
  'game-ui/overlay/logo-screen/loading/loading.module.scss',
  ['progress']
);

const useUploadSuccessImageUri = createSingletonHook<string | undefined>(undefined);

export const ScreenshotUploadProgress = memo(function ScreenshotUploadProgressBase({
  uploadProgress
}: Readonly<{ uploadProgress: bindings.JsonUploadProgress }>): ReactElement {
  const { translate } = useLocalization();

  const [successImageUri, setSuccessImageUri] = useUploadSuccessImageUri();

  // This useEffect is used to display the success image after the upload is complete, but only
  // after some time so the progress circles have finished animating.
  useEffect(() => {
    // Normal/in progress state, hide the success image.
    if (!uploadProgress.isComplete) {
      setSuccessImageUri(undefined);
    }
    // Upload is complete, and the success image is not shown yet, display it after the progress
    // animation is done.
    else if (uploadProgress.isComplete && !successImageUri) {
      setTimeout(() => {
        setSuccessImageUri(getRandomUploadSuccessImage());
      }, 1500 /* This is roughly the takes it takes for the animation */);
    }
  }, [uploadProgress, successImageUri]);

  // noinspection HtmlRequiredAltAttribute
  return (
    <div className={styles.uploadProgress}>
      <div className={styles.uploadProgressBackgroundColor} />

      <div
        className={classNames(styles.uploadProgressContent, {
          [styles.uploadProgressContentUploadSuccess]: successImageUri != null
        })}>
        {successImageUri ? (
          <img
            src={successImageUri}
            width={loadingProgressVanillaProps.size}
            height={loadingProgressVanillaProps.size}
            // This class, which is applied to <LoadingProgress /> by the game, can be reused as-is
            // for the image.
            className={coLoadingStyles.progress}
          />
        ) : (
          <LoadingProgress
            {...loadingProgressVanillaProps}
            progress={[
              uploadProgress.globalProgress,
              uploadProgress.processingProgress,
              uploadProgress.uploadProgress
            ]}
          />
        )}

        <div className={styles.uploadProgressContentHint}>
          {getUploadProgressHintText(translate, uploadProgress)}
        </div>
      </div>
    </div>
  );
});

function getRandomUploadSuccessImage(): string {
  const images = [
    'Media/Game/Climate/Sun.svg',
    'Media/Game/Icons/Content.svg',
    'Media/Game/Icons/Happy.svg',
    'Media/Game/Icons/TouristAttractions.svg',
    'Media/Game/Icons/Trophy.svg',
    'Media/Game/Notifications/LeveledUp.svg'
  ];

  // biome-ignore lint/style/noNonNullAssertion: always has at least 1 element.
  return images[Math.floor(Math.random() * images.length)]!;
}
