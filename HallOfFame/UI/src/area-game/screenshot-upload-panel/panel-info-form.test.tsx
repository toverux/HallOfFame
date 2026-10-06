import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { makeScreenshotSnapshot } from '../../testing/fixtures';
import { resetBindings, setBinding } from '../../testing/game-setup';
import { ScreenshotUploadPanelContentScreenshotInfo } from './panel-info-form';

afterEach(() => {
  cleanup();
  resetBindings();
});

function noop(): void {
  // Editing the form is not what these tests look at.
}

describe('ScreenshotUploadPanelContentScreenshotInfo', () => {
  it(`offers no asset to showcase while the playset could not be read`, () => {
    // The game leaves the asset mods unset until a capture reads the playset.
    setBinding('hallOfFame.capture', 'assetMods', null);
    // Read by the vanilla text field the description is typed in.
    setBinding('input', 'useTextFieldInputBarrier', false);

    render(
      <ScreenshotUploadPanelContentScreenshotInfo
        creatorNameIsEmpty={false}
        screenshotSnapshot={makeScreenshotSnapshot()}
        formValue={{
          shareModIds: true,
          shareRenderSettings: true,
          isShowcasingAsset: false,
          showcasedMod: undefined,
          description: ''
        }}
        patchFormValue={noop}
      />
    );

    expect(
      screen.queryByText('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_LABEL')
    ).toBeNull();
  });
});
