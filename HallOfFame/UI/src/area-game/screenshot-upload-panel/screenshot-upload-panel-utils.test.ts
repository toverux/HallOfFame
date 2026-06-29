import { describe, expect, it } from 'bun:test';
import type { Localization } from 'cs2/l10n';
import type { JsonScreenshotSnapshot, JsonUploadProgress } from '../../utils/bindings';
import { getRatioPreviewInfo, getUploadProgressHintText } from './screenshot-upload-panel-utils';

function snapshotWithSize(imageWidth: number, imageHeight: number): JsonScreenshotSnapshot {
  return {
    achievedMilestone: 0,
    population: 0,
    previewImageUri: '',
    imageUri: '',
    imageFileSize: 0,
    imageWidth,
    imageHeight,
    wasGlobalIlluminationDisabled: false,
    areSettingsTopQuality: true
  };
}

function progress(values: Partial<JsonUploadProgress>): JsonUploadProgress {
  return {
    isComplete: false,
    globalProgress: 0,
    uploadProgress: 0,
    processingProgress: 0,
    ...values
  };
}

// A fake that echoes the localization id back, so assertions can match on the key.
const echoTranslate: Localization['translate'] = id => id;

describe('getRatioPreviewInfo', () => {
  it(`reports 'equal' for an exact 16:9 image`, () => {
    expect(getRatioPreviewInfo(snapshotWithSize(1280, 720)).type).toBe('equal');
  });

  it(`reports 'narrower' and shrinks the width for an ultrawide image`, () => {
    const info = getRatioPreviewInfo(snapshotWithSize(2560, 1080));

    expect(info.type).toBe('narrower');
    // The 16:9 preview rectangle is narrower than the ultrawide image.
    expect(info.style.width).toBe(`${(16 / 9 / (2560 / 1080)) * 100}%`);
    expect(info.style.height).toBe('99%');
  });

  it(`reports 'wider' and shrinks the height for a taller-than-16:9 image`, () => {
    const info = getRatioPreviewInfo(snapshotWithSize(1024, 768));

    expect(info.type).toBe('wider');
    expect(info.style.width).toBe('99%');
    expect(info.style.height).toBe(`${(1024 / 768 / (16 / 9)) * 100}%`);
  });
});

describe('getUploadProgressHintText', () => {
  it(`is the waiting hint before the upload starts`, () => {
    expect(getUploadProgressHintText(echoTranslate, progress({ uploadProgress: 0 }))).toBe(
      'HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Waiting]'
    );
  });

  it(`is the uploading hint while bytes are going up but processing has not begun`, () => {
    const hint = getUploadProgressHintText(
      echoTranslate,
      progress({ uploadProgress: 0.5, processingProgress: 0 })
    );

    expect(hint).toBe('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Uploading]');
  });

  it(`is the processing hint while the server processes the upload`, () => {
    const hint = getUploadProgressHintText(
      echoTranslate,
      progress({ uploadProgress: 1, processingProgress: 0.5, isComplete: false })
    );

    expect(hint).toBe('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Processing]');
  });

  it(`is the complete hint once the upload is done`, () => {
    const hint = getUploadProgressHintText(
      echoTranslate,
      progress({ uploadProgress: 1, processingProgress: 1, isComplete: true })
    );

    expect(hint).toBe('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Complete]');
  });
});
