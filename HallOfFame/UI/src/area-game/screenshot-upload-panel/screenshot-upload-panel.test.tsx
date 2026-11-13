import { afterEach, describe, expect, it } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { makeScreenshotSnapshot } from '../../testing/fixtures';
import { resetBindings, setBinding } from '../../testing/game-setup';
import { ScreenshotUploadPanel } from './screenshot-upload-panel';

afterEach(() => {
  cleanup();
  resetBindings();
});

describe('ScreenshotUploadPanel', () => {
  it(`keeps what the creator typed when the full image of the same capture turns ready`, () => {
    setBinding('hallOfFame.capture', 'cityName', 'City');
    setBinding(
      'hallOfFame.capture',
      'screenshotSnapshot',
      makeScreenshotSnapshot({ previewImageUri: 'live://halloffame/p-1', isImageReady: false })
    );

    render(<ScreenshotUploadPanel />);

    // The description is the panel's only multiline text field.
    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox');

    fireEvent.change(textarea, { target: { value: 'A city.' } });

    expect(textarea.value).toBe('A city.');

    act(() =>
      setBinding(
        'hallOfFame.capture',
        'screenshotSnapshot',
        makeScreenshotSnapshot({ previewImageUri: 'live://halloffame/p-1', isImageReady: true })
      )
    );

    expect(textarea.value).toBe('A city.');

    act(() =>
      setBinding(
        'hallOfFame.capture',
        'screenshotSnapshot',
        makeScreenshotSnapshot({ previewImageUri: 'live://halloffame/p-2', isImageReady: false })
      )
    );

    expect(textarea.value).toBe('');
  });
});
