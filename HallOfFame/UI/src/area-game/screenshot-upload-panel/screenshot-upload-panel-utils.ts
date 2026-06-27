import type { Localization } from 'cs2/l10n';
import type { CSSProperties } from 'react';
import type { JsonScreenshotSnapshot, JsonUploadProgress } from '../../bindings';

/**
 * Computes the type and style of the ratio preview overlay on the image, helping the user to
 * understand how the image will be cropped on the most common aspect ratio, 16:9.
 */
export function getRatioPreviewInfo(screenshot: JsonScreenshotSnapshot) {
  const mostCommonRatio = 16 / 9;

  const ratio = screenshot.imageWidth / screenshot.imageHeight;

  const type = ratio == mostCommonRatio ? 'equal' : ratio > mostCommonRatio ? 'narrower' : 'wider';

  // We use 99% as a max below to leave a small padding around the preview ration rectangle, making
  // it cleaner than if it hits the edge of the image.
  // Note that `calc(100% - Xrem)` which would be better, is not supported by cohtml.
  const style = {
    width: type == 'wider' ? '99%' : `${(mostCommonRatio / ratio) * 100}%`,
    height: type == 'wider' ? `${(ratio / mostCommonRatio) * 100}%` : '99%'
  } satisfies CSSProperties;

  return { type, style } as const;
}

/**
 * Gets the hint text for the upload progress depending on the state of {@link uploadProgress}
 * (pending, uploading, processing).
 */
export function getUploadProgressHintText(
  translate: Localization['translate'],
  uploadProgress: JsonUploadProgress
): string | null {
  if (uploadProgress.uploadProgress == 0) {
    return translate('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Waiting]');
  }

  if (uploadProgress.uploadProgress > 0 && uploadProgress.processingProgress == 0) {
    return translate('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Uploading]');
  }

  if (uploadProgress.processingProgress > 0 && !uploadProgress.isComplete) {
    return translate('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Processing]');
  }

  if (uploadProgress.isComplete) {
    return translate('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Complete]');
  }

  return null;
}
