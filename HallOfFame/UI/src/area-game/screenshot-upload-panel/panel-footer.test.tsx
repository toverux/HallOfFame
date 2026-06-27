import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTriggers, resetBindings } from '../../testing/game-setup';
import type { DraggableProps } from '../../utils';
import type { ScreenshotInfoFormValue } from './form-state';
import { ScreenshotUploadPanelFooter } from './panel-footer';

afterEach(() => {
  cleanup();
  resetBindings();
});

const draggable: DraggableProps = {
  onMouseDown: () => {
    // No-op: dragging is irrelevant to these tests.
  }
};

const validForm: ScreenshotInfoFormValue = {
  shareModIds: true,
  shareRenderSettings: false,
  isShowcasingAsset: false,
  showcasedMod: undefined,
  description: '  Nice city  '
};

const uploadEvent = 'hallOfFame.capture.uploadScreenshot';

// translate() returns the id when no fallback is given, so the Share button's label is its id.
const shareLabel = 'HallOfFame.UI.Game.ScreenshotUploadPanel.SHARE';

describe('ScreenshotUploadPanelFooter', () => {
  it(`triggers uploadScreenshot with the built payload when Share is clicked`, async () => {
    render(
      <ScreenshotUploadPanelFooter
        creatorNameIsEmpty={false}
        uploadProgress={null}
        draggable={draggable}
        formValue={validForm}
      />
    );

    await userEvent.setup().click(screen.getByText(shareLabel));

    const upload = getTriggers().find(trigger => trigger.event == uploadEvent);

    expect(upload?.args[0]).toEqual({
      shareModIds: true,
      shareRenderSettings: false,
      showcasedModId: null,
      description: 'Nice city'
    });
  });

  it(`disables Share when showcasing an asset without a picked mod`, () => {
    const invalidForm: ScreenshotInfoFormValue = {
      ...validForm,
      isShowcasingAsset: true,
      showcasedMod: undefined
    };

    render(
      <ScreenshotUploadPanelFooter
        creatorNameIsEmpty={false}
        uploadProgress={null}
        draggable={draggable}
        formValue={invalidForm}
      />
    );

    const shareButton = screen.getByText(shareLabel).closest('button');

    expect(shareButton?.disabled).toBe(true);
  });
});
