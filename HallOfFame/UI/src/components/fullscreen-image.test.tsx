import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventInputProvider } from 'cs2/input';
import { noop } from '../testing/fixtures';
import { emitEvent, resetBindings, setBinding } from '../testing/game-setup';
import { FullscreenImage } from './fullscreen-image';

const RealImage = globalThis.Image;

afterEach(() => {
  cleanup();
  resetBindings();

  globalThis.Image = RealImage;
});

/**
 * The layer drawing an image, found by the inline style that draws it: a CSS module class reads
 * `undefined` in a test.
 */
function getLayer(src: string): HTMLElement {
  const layer = document.querySelector<HTMLElement>(`[style*="${src}"]`);

  expect(layer).not.toBeNull();

  // oxlint-disable-next-line typescript/no-non-null-assertion - asserted just above
  return layer!;
}

function getImage(): HTMLElement {
  return getLayer('full.jpg');
}

/**
 * Stands in for the browser's `Image`, which happy-dom never loads, and lets a test say when the
 * last one created finished loading; the file's `afterEach` puts the real one back.
 */
function fakeImageLoading(): { load: () => void } {
  const images: Array<{ onload: (() => void) | null }> = [];

  globalThis.Image = class {
    public onload: (() => void) | null = null;

    public onerror: (() => void) | null = null;

    public src = '';

    public constructor() {
      images.push(this);
    }
  } as unknown as typeof Image;

  return {
    load: () => {
      images.at(-1)?.onload?.();
    }
  };
}

function getCloseButton(): HTMLElement {
  // The close button is the component's only button.
  return screen.getByRole('button');
}

describe('FullscreenImage', () => {
  it(`shows the image over the whole screen, with a close button`, () => {
    render(
      <FullscreenImage
        src='coui://halloffame/full.jpg'
        placeholderSrc='live://halloffame/preview'
        onClose={noop}
      />
    );

    expect(getImage().style.backgroundImage).toContain('coui://halloffame/full.jpg');
    expect(getCloseButton()).toBeDefined();
  });

  it(`shows the preview at once, and the full image over it once loaded`, async () => {
    const loading = fakeImageLoading();

    render(
      <FullscreenImage
        src='coui://halloffame/full.jpg'
        placeholderSrc='live://halloffame/preview'
        onClose={noop}
      />
    );

    expect(getLayer('preview').style.backgroundImage).toContain('live://halloffame/preview');
    expect(getImage().style.opacity).toBe('0');

    loading.load();

    await waitFor(() => {
      expect(getImage().style.opacity).toBe('1');
    });
  });

  it(`closes on its close button`, async () => {
    const onClose = mock(noop);

    render(
      <FullscreenImage
        src='coui://halloffame/full.jpg'
        placeholderSrc='live://halloffame/preview'
        onClose={onClose}
      />
    );

    await userEvent.setup().click(getCloseButton());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it(`closes on a click anywhere`, async () => {
    const onClose = mock(noop);

    render(
      <FullscreenImage
        src='coui://halloffame/full.jpg'
        placeholderSrc='live://halloffame/preview'
        onClose={onClose}
      />
    );

    await userEvent.setup().click(getImage());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it(`closes on Back, with nothing focused`, async () => {
    const onClose = mock(noop);

    // The actions the game reports as bound, which the input root reads before it listens.
    setBinding('input', 'actionNames', ['Back']);

    render(
      <EventInputProvider>
        <FullscreenImage
          src='coui://halloffame/full.jpg'
          placeholderSrc='live://halloffame/preview'
          onClose={onClose}
        />
      </EventInputProvider>
    );

    // The input stack takes in a new consumer on the next frame, so Back is resent until it lands.
    await waitFor(() => {
      emitEvent('input.onActionPerformed.update', { action: 'Back', value: null });

      expect(onClose).toHaveBeenCalled();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
