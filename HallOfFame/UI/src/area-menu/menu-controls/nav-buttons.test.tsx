import { afterEach, describe, expect, it } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getTriggers, getUsageEvents, resetBindings, setBinding } from '../../testing/game-setup';
import { MenuControlsNextButton, MenuControlsPreviousButton } from './nav-buttons';

afterEach(() => {
  cleanup();
  resetBindings();
});

function slideshowTriggers(): readonly string[] {
  return getTriggers()
    .map(({ event }) => event)
    .filter(event => event.startsWith('hallOfFame.slideshow.'));
}

function soundTriggers(): readonly string[] {
  return getTriggers()
    .map(({ event }) => event)
    .filter(event => event == 'audio.playSound');
}

describe('MenuControlsNextButton', () => {
  it(`moves on from a button press, tracked as via the button`, () => {
    render(<MenuControlsNextButton isLoading={false} />);

    fireEvent.mouseDown(screen.getByRole('button'));

    expect(slideshowTriggers()).toEqual(['hallOfFame.slideshow.nextScreenshot']);
    expect(getUsageEvents()).toEqual([
      ['slideshow_navigated', { direction: 'next', via: 'button' }]
    ]);
  });

  it(`moves on once from a mouse click, its press having answered it`, () => {
    render(<MenuControlsNextButton isLoading={false} />);

    fireEvent.mouseDown(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));

    expect(slideshowTriggers()).toEqual(['hallOfFame.slideshow.nextScreenshot']);
    expect(soundTriggers()).toEqual(['audio.playSound']);
  });

  it(`moves on from its input action, tracked as via the action`, async () => {
    render(<MenuControlsNextButton isLoading={false} />);

    act(() => {
      setBinding('hallOfFame.slideshow', 'nextScreenshotInputAction.phase', 'Performed');
    });

    // The press is deferred, so its active style shows before the button disables.
    await waitFor(() =>
      expect(slideshowTriggers()).toEqual(['hallOfFame.slideshow.nextScreenshot'])
    );
    expect(getUsageEvents()).toEqual([
      ['slideshow_navigated', { direction: 'next', via: 'action' }]
    ]);
  });
});

describe('MenuControlsPreviousButton', () => {
  it(`goes back from a button press, tracked as via the button`, () => {
    render(<MenuControlsPreviousButton isLoading={false} hasPreviousScreenshot={true} />);

    fireEvent.mouseDown(screen.getByRole('button'));

    expect(slideshowTriggers()).toEqual(['hallOfFame.slideshow.previousScreenshot']);
    expect(getUsageEvents()).toEqual([
      ['slideshow_navigated', { direction: 'previous', via: 'button' }]
    ]);
  });

  it(`goes back from its input action, tracked as via the action`, async () => {
    render(<MenuControlsPreviousButton isLoading={false} hasPreviousScreenshot={true} />);

    act(() => {
      setBinding('hallOfFame.slideshow', 'previousScreenshotInputAction.phase', 'Performed');
    });

    await waitFor(() =>
      expect(slideshowTriggers()).toEqual(['hallOfFame.slideshow.previousScreenshot'])
    );
    expect(getUsageEvents()).toEqual([
      ['slideshow_navigated', { direction: 'previous', via: 'action' }]
    ]);
  });
});
