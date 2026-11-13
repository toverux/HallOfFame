import { afterEach, describe, expect, it } from 'bun:test';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeScreenshotSnapshot } from '../testing/fixtures';
import { getTriggers, resetBindings, setBinding } from '../testing/game-setup';
import { TakeHofPictureButton } from './take-hof-picture-button';

afterEach(() => {
  cleanup();
  resetBindings();
});

// The vanilla Take Photo button the photo mode panel hands over as a template.
const template = '<button><div></div></button>';

/**
 * Stands in for `requestAnimationFrame`, so a test runs the frames one by one.
 */
function makeFrames(): { requestFrame: (onFrame: () => void) => void; tick: () => void } {
  const pending: Array<() => void> = [];

  return {
    requestFrame: onFrame => {
      pending.push(onFrame);
    },
    tick: () => {
      act(() => {
        for (const onFrame of pending.splice(0)) {
          onFrame();
        }
      });
    }
  };
}

function countTakeScreenshotTriggers(): number {
  return getTriggers().filter(trigger => trigger.event == 'hallOfFame.capture.takeScreenshot')
    .length;
}

function readShutterSounds(): Array<readonly unknown[]> {
  return getTriggers()
    .filter(trigger => trigger.event == 'audio.playSound')
    .map(trigger => trigger.args);
}

function readVeilPhase(): string | null {
  return document.querySelector('[data-veil-phase]')?.getAttribute('data-veil-phase') ?? null;
}

describe('TakeHofPictureButton', () => {
  it(`shows the veil, triggers the capture and its shutter two frames later, then fades the veil`, async () => {
    const user = userEvent.setup();
    const frames = makeFrames();

    render(<TakeHofPictureButton html={template} requestFrame={frames.requestFrame} />);

    const button = screen.getByRole('button');

    await user.click(button);

    expect(readVeilPhase()).toBe('shown');
    expect(countTakeScreenshotTriggers()).toBe(0);
    expect(readShutterSounds()).toEqual([]);

    frames.tick();

    expect(countTakeScreenshotTriggers()).toBe(0);

    // A press while the veil is up starts nothing.
    await user.click(button);

    frames.tick();

    expect(countTakeScreenshotTriggers()).toBe(1);
    expect(readShutterSounds()).toEqual([['take-photo', 1]]);
    expect(readVeilPhase()).toBe('shown');

    frames.tick();

    expect(readVeilPhase()).toBe('fading');

    await user.click(button);
    frames.tick();
    frames.tick();

    expect(countTakeScreenshotTriggers()).toBe(1);
    expect(readShutterSounds()).toHaveLength(1);
  });

  it(`ignores a press while the upload panel's full image is not ready`, async () => {
    setBinding(
      'hallOfFame.capture',
      'screenshotSnapshot',
      makeScreenshotSnapshot({ isImageReady: false })
    );

    const frames = makeFrames();

    render(<TakeHofPictureButton html={template} requestFrame={frames.requestFrame} />);

    await userEvent.setup().click(screen.getByRole('button'));

    frames.tick();
    frames.tick();

    expect(readVeilPhase()).toBeNull();
    expect(countTakeScreenshotTriggers()).toBe(0);
  });
});
