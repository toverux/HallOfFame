import { afterEach, describe, expect, it } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { makeMod, makeScreenshot, makeSettings, makeSkyveVerdict } from '../../testing/fixtures';
import { resetBindings, setBinding, setTranslations } from '../../testing/game-setup';
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

    fireEvent.click(screen.getByText('A city.'));

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

  it(`closes the details window on navigating to another screenshot`, () => {
    setBinding(
      'hallOfFame.slideshow',
      'screenshot',
      makeScreenshot({ id: 'first', description: 'A city.', capabilities: ['description'] })
    );

    render(<MenuControlsContent />);

    fireEvent.click(screen.getByText('A city.'));

    expect(screen.getAllByText('A city.')).toHaveLength(2);

    act(() => {
      setBinding(
        'hallOfFame.slideshow',
        'screenshot',
        makeScreenshot({ id: 'second', description: 'A town.', capabilities: ['description'] })
      );
    });

    // The row's preview alone.
    expect(screen.getAllByText('A town.')).toHaveLength(1);
  });

  it(`hides the details row by setting while the key still opens the window`, () => {
    setBinding('hallOfFame.common', 'settings', makeSettings({ showScreenshotDetails: false }));

    setBinding(
      'hallOfFame.slideshow',
      'screenshot',
      makeScreenshot({ description: 'A city.', capabilities: ['description'] })
    );

    render(<MenuControlsContent />);

    expect(screen.queryByText('A city.')).toBeNull();

    act(() => {
      setBinding('hallOfFame.slideshow', 'screenshotDetailsInputAction.phase', 'Performed');
    });

    // The window's body alone.
    expect(screen.getAllByText('A city.')).toHaveLength(1);
  });

  describe('showcased mod', () => {
    function showcase(stability?: string): void {
      setTranslations({
        'HallOfFame.UI.Menu.ScreenshotDetails.SKYVE[Verdict]': 'Skyve: {LABEL}',
        'HallOfFame.Skyve.CautionWhenUsing': 'Caution when using it',
        'HallOfFame.Skyve.NotEnoughInformation': 'Not enough information'
      });

      setBinding(
        'hallOfFame.slideshow',
        'screenshot',
        makeScreenshot({
          showcasedMod: makeMod({
            paradoxModId: 1,
            name: 'Traffic',
            skyve: stability == undefined ? null : makeSkyveVerdict({ stability })
          })
        })
      );

      render(<MenuControlsContent />);
    }

    function skyveLine(): Element | null {
      return document.querySelector('[data-tone]');
    }

    it(`shows Skyve's exact verdict under its author`, () => {
      showcase('cautionWhenUsing');

      expect(skyveLine()?.textContent).toBe('Skyve: Caution when using it');
      expect(skyveLine()?.getAttribute('data-tone')).toBe('warning');
    });

    it(`shows no Skyve line without a verdict`, () => {
      showcase();

      expect(screen.getByText('Traffic')).toBeDefined();
      expect(skyveLine()).toBeNull();
    });

    it(`shows no Skyve line for a verdict lacking information`, () => {
      showcase('notEnoughInformation');

      expect(screen.getByText('Traffic')).toBeDefined();
      expect(skyveLine()).toBeNull();
    });
  });
});
