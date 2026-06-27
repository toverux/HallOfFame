import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import type { JsonScreenshotSnapshot, ModSettings } from '../../bindings';
import { resetBindings, setBinding } from '../../testing/game-setup';
import { ScreenshotUploadPanelContentCityInfo } from './panel-city-info';

afterEach(() => {
  cleanup();
  resetBindings();
});

const settings: ModSettings = {
  creatorName: 'Alice',
  enableLoadingScreenBackground: true,
  showFeaturedAsset: true,
  showCreatorSocials: true,
  showViewCount: false,
  screenshotResolution: 'fhd',
  namesTranslationMode: 'translate',
  creatorsScreenshotSaveDirectory: '',
  baseUrl: '',
  savedShareModIdsPreference: true,
  savedShareRenderSettingsPreference: true,
  savedScreenshotDescription: ''
};

const snapshot: JsonScreenshotSnapshot = {
  achievedMilestone: 5,
  population: 12_345,
  previewImageUri: '',
  imageUri: '',
  imageFileSize: 0,
  imageWidth: 1920,
  imageHeight: 1080,
  wasGlobalIlluminationDisabled: false,
  areSettingsTopQuality: true
};

describe('ScreenshotUploadPanelContentCityInfo', () => {
  it(`renders the city name served by the cityName value binding`, () => {
    setBinding('hallOfFame.capture', 'cityName', 'Springfield');

    render(
      <ScreenshotUploadPanelContentCityInfo
        settings={settings}
        screenshotSnapshot={snapshot}
        creatorNameIsEmpty={true}
      />
    );

    expect(screen.getByText('Springfield')).toBeDefined();
  });
});
