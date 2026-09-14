import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventInputProvider } from 'cs2/input';
import { makeScreenshot, makeSettings } from '../../testing/fixtures';
import { emitEvent, resetBindings, setBinding } from '../../testing/game-setup';
import { TransitionContext } from '../../vanilla-modules/game-ui/common/animations/transition-context';
import { ScreenshotDetailsWindow } from './screenshot-details-window';

afterEach(() => {
  cleanup();
  resetBindings();
});

function noop(): void {
  // Closing is not what these tests look at.
}

describe('ScreenshotDetailsWindow', () => {
  it(`renders the description's bold, leading heading, and explicit line breaks`, () => {
    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({
          description: '# Harbour\nA **tram** loop.\nBy the quay.',
          capabilities: ['description']
        })}
        isOpen={true}
        onClose={noop}
      />
    );

    expect(screen.getByText('tram').tagName).toBe('B');

    // The hashes are consumed into a heading style, so the heading paragraph is styled apart from
    // the body one.
    const heading = screen.getByText('Harbour');
    const body = screen.getByText('tram').parentElement;

    expect(heading.textContent).toBe('Harbour');
    expect(heading.className).not.toBe(body?.className);

    // A newline is the line break that works: each line becomes a paragraph of its own.
    const nextLine = screen.getByText('By the quay.');

    expect(nextLine.tagName).toBe('P');
    expect(nextLine).not.toBe(body);
  });

  it(`leaves unsupported markdown as literal text`, () => {
    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({
          description: 'The *night* lighting.',
          capabilities: ['description']
        })}
        isOpen={true}
        onClose={noop}
      />
    );

    expect(screen.getByText('The *night* lighting.')).toBeDefined();
  });

  it(`says the creator shared nothing when the screenshot could have carried a description`, () => {
    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({ description: '', capabilities: ['description'] })}
        isOpen={true}
        onClose={noop}
      />
    );

    expect(
      screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.DESCRIPTION[Not Shared]')
    ).toBeDefined();
  });

  it(`says the screenshot predates descriptions when it could not have carried one`, () => {
    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({ description: '', capabilities: [] })}
        isOpen={true}
        onClose={noop}
      />
    );

    expect(
      screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.DESCRIPTION[Predates Feature]')
    ).toBeDefined();
  });

  it(`titles itself with the city name in the form the controls show`, () => {
    setBinding('hallOfFame.common', 'locale', 'en-US');
    setBinding(
      'hallOfFame.common',
      'settings',
      makeSettings({ namesTranslationMode: 'translate' })
    );

    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({
          cityName: 'Ville-Lumière',
          cityNameTranslated: 'City of Light',
          cityNameLocale: 'fr-FR'
        })}
        isOpen={true}
        onClose={noop}
      />
    );

    expect(screen.getByText('City of Light')).toBeDefined();
    expect(screen.queryByText('Ville-Lumière')).toBeNull();
  });

  it(`falls back to the native city name when the chosen form is missing`, () => {
    setBinding('hallOfFame.common', 'locale', 'en-US');
    setBinding(
      'hallOfFame.common',
      'settings',
      makeSettings({ namesTranslationMode: 'translate' })
    );

    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({ cityName: 'Ville-Lumière', cityNameLocale: 'fr-FR' })}
        isOpen={true}
        onClose={noop}
      />
    );

    expect(screen.getByText('Ville-Lumière')).toBeDefined();
  });

  it(`renders nothing while closed`, () => {
    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({ description: 'A city.', capabilities: ['description'] })}
        isOpen={false}
        onClose={noop}
      />
    );

    expect(screen.queryByText('A city.')).toBeNull();
  });

  it(`follows the screenshot it is handed instead of keeping the first one`, () => {
    const capabilities = ['description'] as const;

    const { rerender } = render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({ id: 'a', description: 'First.', capabilities })}
        isOpen={true}
        onClose={noop}
      />
    );

    rerender(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({ id: 'b', description: 'Second.', capabilities })}
        isOpen={true}
        onClose={noop}
      />
    );

    expect(screen.queryByText('First.')).toBeNull();
    expect(screen.getByText('Second.')).toBeDefined();
  });

  it(`stays out of the transition group it is rendered from, so closing it leaves the menu`, () => {
    const onUnmount = mock(noop);

    const groupContext = { state: 0, onMount: noop, onUnmount };

    const screenshot = makeScreenshot({ description: 'A city.', capabilities: ['description'] });

    const { rerender, unmount } = render(
      // oxlint-disable-next-line react/jsx-no-constructed-context-values - one fixture, reused below
      <TransitionContext.Provider value={groupContext}>
        <ScreenshotDetailsWindow screenshot={screenshot} isOpen={true} onClose={noop} />
      </TransitionContext.Provider>
    );

    rerender(
      // oxlint-disable-next-line react/jsx-no-constructed-context-values - the fixture from above
      <TransitionContext.Provider value={groupContext}>
        <ScreenshotDetailsWindow screenshot={screenshot} isOpen={false} onClose={noop} />
      </TransitionContext.Provider>
    );

    unmount();

    // The group would drop the child it registered the window under: the main menu screen.
    expect(onUnmount).not.toHaveBeenCalled();
  });

  it(`closes from its title bar's close button`, async () => {
    const onClose = mock(noop);

    // The title bar drops its close button under a gamepad, where Back closes the panel instead,
    // and the game's control scheme binding defaults to the gamepad. 0 is keyboard and mouse.
    setBinding('input', 'controlScheme', 0);

    render(
      <ScreenshotDetailsWindow
        // The title bar, close button included, only renders with a title to show.
        screenshot={makeScreenshot({
          cityName: 'Springfield',
          description: 'A city.',
          capabilities: ['description']
        })}
        isOpen={true}
        onClose={onClose}
      />
    );

    const closeButton = [...document.querySelectorAll('button')].find(
      button => button.textContent == ''
    );

    expect(closeButton).toBeDefined();

    // oxlint-disable-next-line typescript/no-non-null-assertion - asserted just above
    await userEvent.setup().click(closeButton!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it(`closes on Back, although the slideshow controls never hold the focus`, async () => {
    const onClose = mock(noop);

    // The actions the game reports as bound, which the input root reads before it listens.
    setBinding('input', 'actionNames', ['Back']);

    render(
      <EventInputProvider>
        <ScreenshotDetailsWindow
          screenshot={makeScreenshot({ description: 'A city.', capabilities: ['description'] })}
          isOpen={true}
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
