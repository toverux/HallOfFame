import { afterEach, describe, expect, it } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { makeScreenshot } from '../../testing/fixtures';
import { resetBindings, setBinding } from '../../testing/game-setup';
import { MenuControlsContent } from './menu-controls';

afterEach(() => {
  cleanup();
  resetBindings();
});

describe('MenuControlsContent', () => {
  it(`keeps the details window closed when a screenshot comes back after a load error`, () => {
    setBinding(
      'hallOfFame.slideshow',
      'screenshot',
      makeScreenshot({ description: 'A city.', capabilities: ['description'] })
    );

    render(<MenuControlsContent />);

    fireEvent.mouseDown(screen.getByText('A city.'));

    // The row's preview and the window's body.
    expect(screen.getAllByText('A city.')).toHaveLength(2);

    // A failed load swaps the controls for the error view, and the next load brings them back.
    act(() => {
      setBinding('hallOfFame.slideshow', 'loadError', {
        id: 'HallOfFame.Test.LOAD_ERROR',
        value: 'Could not load.'
      });
    });

    act(() => {
      setBinding('hallOfFame.slideshow', 'loadError', null);
    });

    expect(screen.getAllByText('A city.')).toHaveLength(1);
  });
});
