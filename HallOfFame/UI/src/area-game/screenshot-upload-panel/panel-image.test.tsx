import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it(`opens the full image over the screen on the maximize button, and closes it on a click`, async () => {
    render(
      <ScreenshotUploadPanelImage
        screenshotSnapshot={makeScreenshotSnapshot({
          imageUri: 'coui://halloffame/full.jpg',
          isImageReady: true
        })}
        uploadProgress={null}
      />
    );

    // The maximized image is the only element drawing the full image as its background.
    const getFullscreenImage = (): HTMLElement | null =>
      document.querySelector<HTMLElement>('[style*="full.jpg"]');

    expect(getFullscreenImage()).toBeNull();

    const user = userEvent.setup();

    await user.click(screen.getByRole('button'));

    const fullscreenImage = getFullscreenImage();

    expect(fullscreenImage).not.toBeNull();

    // The maximized image brings its own close button, beside the maximize one.
    expect(screen.getAllByRole('button')).toHaveLength(2);

    // oxlint-disable-next-line typescript/no-non-null-assertion - asserted just above
    await user.click(fullscreenImage!);

    expect(getFullscreenImage()).toBeNull();
  });

  it(`opens the full image on a click on the preview, once the full image is ready`, async () => {
    const { container, rerender } = render(
      <ScreenshotUploadPanelImage
        screenshotSnapshot={makeScreenshotSnapshot({
          imageUri: 'coui://halloffame/full.jpg',
          isImageReady: false
        })}
        uploadProgress={null}
      />
    );

    const getFullscreenImage = (): HTMLElement | null =>
      document.querySelector<HTMLElement>('[style*="full.jpg"]');

    // The preview is the panel image's only `<img>`.
    const preview = container.querySelector('img');

    expect(preview).not.toBeNull();

    const user = userEvent.setup();

    // oxlint-disable-next-line typescript/no-non-null-assertion - asserted just above
    await user.click(preview!);

    expect(getFullscreenImage()).toBeNull();

    rerender(
      <ScreenshotUploadPanelImage
        screenshotSnapshot={makeScreenshotSnapshot({
          imageUri: 'coui://halloffame/full.jpg',
          isImageReady: true
        })}
        uploadProgress={null}
      />
    );

    // oxlint-disable-next-line typescript/no-non-null-assertion - asserted above
    await user.click(preview!);

    expect(getFullscreenImage()).not.toBeNull();
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
