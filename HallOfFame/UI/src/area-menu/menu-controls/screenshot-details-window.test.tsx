import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventInputProvider } from 'cs2/input';
import {
  makeCreator,
  makeScreenshot,
  makeSettings,
  photoModeCatalog
} from '../../testing/fixtures';
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

function nextFrame(): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new - requestAnimationFrame only takes a callback
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

describe('ScreenshotDetailsWindow', () => {
  it(`renders the description's bold, leading heading, and explicit line breaks`, () => {
    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({
          description: '# Harbour\nA **tram** loop.\nBy the quay.',
          capabilities: ['description']
        })}
        openTab='description'
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

  it(`shows a tab for the description, the photo mode settings, and the playset`, () => {
    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({ description: 'A city.', capabilities: ['description'] })}
        openTab='description'
        onClose={noop}
      />
    );

    expect(screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.TAB[Description]')).toBeDefined();
    expect(
      screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.TAB[Photo Mode Settings]')
    ).toBeDefined();
    expect(screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.TAB[Playset]')).toBeDefined();
  });

  it(`shows the photo mode settings and says the playset is coming when selected`, async () => {
    const user = userEvent.setup();

    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({ description: 'A city.', capabilities: ['description'] })}
        openTab='description'
        onClose={noop}
      />
    );

    await user.click(
      screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.TAB[Photo Mode Settings]')
    );

    expect(
      screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Predates Feature]')
    ).toBeDefined();
    expect(screen.queryByText('A city.')).toBeNull();

    await user.click(screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.TAB[Playset]'));

    expect(screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Coming]')).toBeDefined();
  });

  it(`switches tabs on Switch Tab, although the controls never hold the focus`, async () => {
    // The actions the game reports as bound, which the input root reads before it listens.
    setBinding('input', 'actionNames', ['Switch Tab']);

    render(
      <EventInputProvider>
        <ScreenshotDetailsWindow
          screenshot={makeScreenshot({ description: 'A city.', capabilities: ['description'] })}
          openTab='description'
          onClose={noop}
        />
      </EventInputProvider>
    );

    const photoModeSettings =
      'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Predates Feature]';
    const playset = 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Coming]';

    // The input stack takes in a new consumer on the next frame.
    await nextFrame();

    emitEvent('input.onActionPerformed.update', { action: 'Switch Tab', value: 1 });

    expect(await screen.findByText(photoModeSettings)).toBeDefined();

    emitEvent('input.onActionPerformed.update', { action: 'Switch Tab', value: 1 });

    expect(await screen.findByText(playset)).toBeDefined();

    // Past the last tab, it wraps around to the first, both ways.
    emitEvent('input.onActionPerformed.update', { action: 'Switch Tab', value: 1 });

    expect(await screen.findByText('A city.')).toBeDefined();

    emitEvent('input.onActionPerformed.update', { action: 'Switch Tab', value: -1 });

    expect(await screen.findByText(playset)).toBeDefined();
  });

  it(`leaves unsupported markdown as literal text`, () => {
    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({
          description: 'The *night* lighting.',
          capabilities: ['description']
        })}
        openTab='description'
        onClose={noop}
      />
    );

    expect(screen.getByText('The *night* lighting.')).toBeDefined();
  });

  it(`says the creator shared nothing when the screenshot could have carried a description`, () => {
    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({ description: '', capabilities: ['description'] })}
        openTab='description'
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
        openTab='description'
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
        openTab='description'
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
        openTab='description'
        onClose={noop}
      />
    );

    expect(screen.getByText('Ville-Lumière')).toBeDefined();
  });

  it(`renders nothing while closed`, () => {
    render(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({ description: 'A city.', capabilities: ['description'] })}
        openTab={undefined}
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
        openTab='description'
        onClose={noop}
      />
    );

    rerender(
      <ScreenshotDetailsWindow
        screenshot={makeScreenshot({ id: 'b', description: 'Second.', capabilities })}
        openTab='description'
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
        <ScreenshotDetailsWindow screenshot={screenshot} openTab='description' onClose={noop} />
      </TransitionContext.Provider>
    );

    rerender(
      // oxlint-disable-next-line react/jsx-no-constructed-context-values - the fixture from above
      <TransitionContext.Provider value={groupContext}>
        <ScreenshotDetailsWindow screenshot={screenshot} openTab={undefined} onClose={noop} />
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
        openTab='description'
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
          openTab='description'
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

  describe('photo mode settings tab', () => {
    // Every photo mode capability, so the tab's state follows the share flag.
    const capabilities = ['shareRenderSettings', 'renderSettings'] as const;

    function renderTab(
      screenshot: Parameters<typeof makeScreenshot>[0],
      settings: Parameters<typeof makeSettings>[0] = {}
    ): void {
      setBinding('hallOfFame.slideshow', 'photoModeCatalog', photoModeCatalog);
      setBinding('hallOfFame.common', 'settings', makeSettings(settings));

      render(
        <ScreenshotDetailsWindow
          screenshot={makeScreenshot({ capabilities, ...screenshot })}
          openTab='photoModeSettings'
          onClose={noop}
        />
      );
    }

    it(`lists the settings under their tab and section, after the notice`, () => {
      renderTab({
        shareRenderSettings: true,
        renderSettings: { 'PhotoModeRenderSystem.iso': '400', 'Time of Day': '9.5' }
      });

      const texts = [
        'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Notice]',
        'Camera',
        'CameraBody',
        'PhotoModeRenderSystem.iso',
        '400',
        'Environment',
        'Time of Day',
        '9.500'
      ];

      const content = document.body.textContent;

      // Each present, and in that order in the document.
      const positions = texts.map(text => {
        expect(screen.getByText(text)).toBeDefined();

        return content.indexOf(text);
      });

      expect(positions).toEqual(positions.toSorted((a, b) => a - b));
    });

    it(`shows each value in its form`, () => {
      renderTab({
        shareRenderSettings: true,
        renderSettings: {
          'PhotoModeRenderSystem.gateFitMode': '2',
          'Vignette.rounded': '1',
          'Vignette.color/r': '1',
          'Vignette.color/g': '0.5',
          'Vignette.color/b': '0',
          'PhotoModeRenderSystem.sensorSize/x': '24.892',
          'PhotoModeRenderSystem.sensorSize/y': '18.669'
        }
      });

      expect(screen.getByText('Horizontal')).toBeDefined();
      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[On]')
      ).toBeDefined();

      // A color is one setting, under the color's name, read as the picker's sliders.
      expect(screen.getByText('Vignette.color')).toBeDefined();
      expect(screen.queryByText('Vignette.color/r')).toBeNull();
      expect(screen.getByText('H').nextSibling?.textContent).toBe('30');
      expect(screen.getByText('S').nextSibling?.textContent).toBe('100');
      expect(screen.queryByText('A')).toBeNull();

      // A vector is one setting listing its components.
      expect(screen.getByText('PhotoModeRenderSystem.sensorSize')).toBeDefined();
      expect(screen.getByText('24.892')).toBeDefined();
      expect(screen.getByText('18.669')).toBeDefined();
    });

    it(`lists a code the game lacks under "Other", raw`, () => {
      renderTab({ shareRenderSettings: true, renderSettings: { 'Env.TimeOfDayEase': '0.25' } });

      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Other]')
      ).toBeDefined();
      expect(screen.getByText('Env.TimeOfDayEase')).toBeDefined();
      expect(screen.getByText('0.25')).toBeDefined();
    });

    it(`notes the light-dependent settings when they are listed`, () => {
      renderTab({
        shareRenderSettings: true,
        renderSettings: {
          'ColorAdjustments.postExposure': '0.5',
          'WhiteBalance.temperature': '10',
          'Time of Day': '9.5'
        }
      });

      for (const note of ['Post Exposure Note', 'White Balance Note', 'Time Of Day Note']) {
        expect(
          screen.getByText(`HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[${note}]`)
        ).toBeDefined();
      }
    });

    it(`notes no setting that is not listed`, () => {
      renderTab({
        shareRenderSettings: true,
        renderSettings: { 'PhotoModeRenderSystem.iso': '400' }
      });

      expect(screen.queryByText(/Note\]$/u)).toBeNull();
    });

    it(`says the game's default settings were used when none were switched on`, () => {
      renderTab({ shareRenderSettings: true });

      expect(
        screen.getByText(
          'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Default Settings]'
        )
      ).toBeDefined();
    });

    it(`says the creator did not share them, showing none of those that arrived`, () => {
      renderTab({ shareRenderSettings: false, renderSettings: { 'Time of Day': '9.5' } });

      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Not Shared]')
      ).toBeDefined();
      expect(screen.queryByText('Time of Day')).toBeNull();
    });

    it(`addresses the creator viewing their own unshared settings`, () => {
      renderTab(
        {
          shareRenderSettings: false,
          renderSettings: { 'Time of Day': '9.5' },
          creator: makeCreator({ id: 'me' })
        },
        { publicCreatorId: 'me' }
      );

      expect(
        screen.getByText(
          'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Not Shared By You]'
        )
      ).toBeDefined();
      expect(screen.queryByText('Time of Day')).toBeNull();
    });

    it(`says the screenshot predates photo mode settings when it could not carry them`, () => {
      renderTab({ capabilities: [], shareRenderSettings: true });

      expect(
        screen.getByText(
          'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Predates Feature]'
        )
      ).toBeDefined();
    });
  });
});
