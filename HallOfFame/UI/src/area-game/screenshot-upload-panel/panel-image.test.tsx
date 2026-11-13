import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import { makeScreenshotSnapshot } from '../../testing/fixtures';
import { resetBindings } from '../../testing/game-setup';
import { ScreenshotUploadPanelImage } from './panel-image';

afterEach(() => {
  cleanup();
  resetBindings();
});

describe('ScreenshotUploadPanelImage', () => {
  it(`disables the maximize button until the full image is ready`, () => {
    const { rerender } = render(
      <ScreenshotUploadPanelImage
        screenshotSnapshot={makeScreenshotSnapshot({ isImageReady: false })}
        uploadProgress={null}
      />
    );

    // The maximize button is the panel image's only button.
    expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(true);

    rerender(
      <ScreenshotUploadPanelImage
        screenshotSnapshot={makeScreenshotSnapshot({ isImageReady: true })}
        uploadProgress={null}
      />
    );

    expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(false);
  });

  it(`lets go of the live preview texture when it unmounts`, () => {
    const { container, unmount } = render(
      <ScreenshotUploadPanelImage
        screenshotSnapshot={makeScreenshotSnapshot({ previewImageUri: 'live://halloffame/p-1' })}
        uploadProgress={null}
      />
    );

    const image = container.querySelector('img');

    expect(image?.getAttribute('src')).toBe('live://halloffame/p-1');

    unmount();

    expect(image?.getAttribute('src')).toBe('');
  });
});
