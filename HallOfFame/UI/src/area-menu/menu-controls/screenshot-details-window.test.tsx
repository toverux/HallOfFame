import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventInputProvider } from 'cs2/input';
import {
  makeCreator,
  makeMod,
  makeScreenshot,
  makeSettings,
  photoModeCatalog
} from '../../testing/fixtures';
import {
  emitEvent,
  getTriggers,
  resetBindings,
  setBinding,
  setTranslations
} from '../../testing/game-setup';
import { TransitionContext } from '../../vanilla-modules/game-ui/common/animations/transition-context';
import { photoModeContainerClasses } from '../../vanilla-modules/game-ui/game/components/photo-mode/widgets/photo-mode-container';
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

  it(`shows the photo mode settings and the playset when selected`, async () => {
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

    expect(
      screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Predates Feature]')
    ).toBeDefined();
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
    const playset = 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Predates Feature]';

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
    const capabilities = ['shareRenderSettings', 'renderSettings', 'renderConditions'] as const;

    // The conditions of a shot in summer daylight, as the mod records them.
    const renderConditions = {
      'time.hour': 14.5,
      'map.latitude': -33.9,
      'climate.season': 'Summer',
      'climate.weather': 'Scattered',
      'climate.temperature': 21.5,
      'sun.elevation': 52.3,
      'post.exposure': 0.75,
      'post.temperature': 15,
      // A tint of 0 is hidden, as every vanilla climate picks it.
      'post.tint': 2,
      'options.dayNightVisuals': true
    };

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

    it(`shows the conditions between the notice and the settings`, () => {
      renderTab({
        shareRenderSettings: true,
        renderSettings: { 'PhotoModeRenderSystem.iso': '400' },
        renderConditions
      });

      const texts = [
        'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Notice]',
        'HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Title]',
        'Summer',
        'HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Weather Scattered]',
        '14:30',
        'HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Latitude South]',
        'HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Sun Elevation]',
        'ColorAdjustments.postExposure',
        'WhiteBalance.temperature',
        'WhiteBalance.tint',
        'Camera'
      ];

      const content = document.body.textContent;

      const positions = texts.map(text => {
        expect(screen.getByText(text)).toBeDefined();

        return content.indexOf(text);
      });

      expect(positions).toEqual(positions.toSorted((a, b) => a - b));
    });

    it(`styles the section titles as the panel does, on their name`, () => {
      renderTab({
        shareRenderSettings: true,
        renderSettings: { 'PhotoModeRenderSystem.iso': '400' },
        renderConditions
      });

      for (const title of [
        'CameraBody',
        'HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Game Chosen]'
      ]) {
        expect(screen.getByText(title).className).toContain(photoModeContainerClasses.groupTitle);
      }
    });

    it(`shows the sun or the moon behind a few clouds, as the game's climate widget does`, () => {
      renderTab({
        shareRenderSettings: true,
        renderConditions: { ...renderConditions, 'climate.weather': 'Few' }
      });

      const sources = [...document.querySelectorAll('img')].map(img => img.getAttribute('src'));

      expect(sources).toContain('Media/Game/Climate/Sun.svg');
      expect(sources).toContain('Media/Game/Climate/Few.svg');
    });

    it(`notes that the conditions were not recorded when it shows only the stored hour`, () => {
      const note = 'HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Not Recorded]';

      renderTab({ shareRenderSettings: true, renderSettings: { 'Time of Day': '11.2' } });

      expect(screen.getByText(note)).toBeDefined();

      cleanup();

      renderTab({ shareRenderSettings: true, renderConditions });

      expect(screen.queryByText(note)).toBeNull();
    });

    it(`says Day/Night visuals was off in place of the hour and the latitude`, () => {
      renderTab({
        shareRenderSettings: true,
        renderConditions: { ...renderConditions, 'options.dayNightVisuals': false }
      });

      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Day Night Visuals Off]')
      ).toBeDefined();
      expect(screen.queryByText('14:30')).toBeNull();
      expect(screen.queryByText(/CONDITIONS\[Latitude/u)).toBeNull();
    });

    it(`shows the conditions above the default settings statement`, () => {
      renderTab({ shareRenderSettings: true, renderConditions });

      const positions = [
        'HallOfFame.UI.Menu.ScreenshotDetails.CONDITIONS[Title]',
        'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Default Settings]'
      ].map(text => {
        expect(screen.getByText(text)).toBeDefined();

        return document.body.textContent.indexOf(text);
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

  describe('playset tab', () => {
    const SLIDESHOW = 'hallOfFame.slideshow';

    // The playset's mods, as the server returns them, most subscribed first.
    const traffic = makeMod({
      paradoxModId: 30,
      name: 'Traffic',
      authorName: 'Ann',
      subscribersCount: 4200
    });

    const trees = makeMod({
      paradoxModId: 10,
      name: 'Trees',
      authorName: 'Bob',
      subscribersCount: 7
    });

    // A shared playset listing those mods.
    const shared = {
      id: 's0',
      capabilities: ['paradoxModIds', 'shareParadoxModIds'],
      shareParadoxModIds: true,
      paradoxModIds: [traffic.paradoxModId, trees.paradoxModId]
    } as const;

    function renderTab(
      screenshot: Parameters<typeof makeScreenshot>[0],
      settings: Parameters<typeof makeSettings>[0] = {}
    ): void {
      setBinding('hallOfFame.common', 'settings', makeSettings(settings));

      render(
        <ScreenshotDetailsWindow
          screenshot={makeScreenshot(screenshot)}
          openTab='playset'
          onClose={noop}
        />
      );
    }

    function loadTriggers(): readonly unknown[] {
      return getTriggers()
        .filter(({ event }) => event == `${SLIDESHOW}.loadPlayset`)
        .map(({ args }) => args[0]);
    }

    function placeholders(): readonly Element[] {
      return [...document.querySelectorAll('[aria-busy="true"]')];
    }

    it(`asks for the playset when opened, and shows placeholders until it arrives`, () => {
      renderTab(shared);

      expect(loadTriggers()).toEqual(['s0']);
      expect(placeholders().length).toBeGreaterThan(0);
    });

    it(`shows placeholders while the playset loaded is another screenshot's`, () => {
      setBinding(SLIDESHOW, 'playset', {
        screenshotId: 'other',
        status: 'loaded',
        mods: [trees]
      });

      renderTab(shared);

      expect(placeholders().length).toBeGreaterThan(0);
      expect(screen.queryByText('Trees')).toBeNull();
    });

    it(`lists the mods with their author, game version, last release, size and subscribers`, () => {
      setTranslations({
        'Common.DECIMAL_SEPARATOR': '.',
        'Common.VALUE_THOUSAND': '{SIGN}{VALUE}K'
      });

      setBinding(SLIDESHOW, 'playset', {
        screenshotId: 's0',
        status: 'loaded',
        mods: [
          {
            ...traffic,
            requiredGameVersion: '1.6.*',
            knownLastReleasedAtFormattedDistance: '13 days ago',
            sizeFormatted: '996.4 kB'
          },
          trees
        ]
      });

      renderTab(shared);

      expect(placeholders()).toHaveLength(0);

      const content = document.body.textContent;

      // Each present, in the server's order.
      const positions = [
        'Traffic',
        'Ann',
        '1.6.*',
        '13 days ago',
        '996.4 kB',
        '4.2K',
        'Trees',
        'Bob'
      ].map(text => {
        expect(screen.getByText(text)).toBeDefined();

        return content.indexOf(text);
      });

      expect(positions).toEqual(positions.toSorted((a, b) => a - b));
    });

    const columnLabels = [
      'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Game Version Column]',
      'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Updated Column]',
      'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Size Column]',
      'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Subscribers Column]'
    ];

    it(`labels the columns once the mods are listed`, () => {
      setBinding(SLIDESHOW, 'playset', { screenshotId: 's0', status: 'loaded', mods: [traffic] });

      renderTab(shared);

      for (const label of columnLabels) {
        expect(screen.getByText(label)).toBeDefined();
      }
    });

    it(`labels no columns while the playset loads`, () => {
      renderTab(shared);

      for (const label of columnLabels) {
        expect(screen.queryByText(label)).toBeNull();
      }
    });

    it(`marks a game version older than the running game's, and only that one`, () => {
      setBinding('menu', 'gameVersion', '1.6.2f1 (8573.1a2b) [2026.09.01.1200]');

      setBinding(SLIDESHOW, 'playset', {
        screenshotId: 's0',
        status: 'loaded',
        mods: [
          { ...traffic, requiredGameVersion: '1.3.*' },
          { ...trees, requiredGameVersion: '1.6.*' }
        ]
      });

      renderTab(shared);

      expect(screen.getByText('1.3.*').dataset.isOlderGameVersion).toBe('true');
      expect(screen.getByText('1.6.*').dataset.isOlderGameVersion).toBeUndefined();
    });

    it(`says which mods are no longer published, in place of their game version`, () => {
      setBinding(SLIDESHOW, 'playset', {
        screenshotId: 's0',
        status: 'loaded',
        mods: [
          { ...traffic, state: 'removed', requiredGameVersion: '1.6.*' },
          { ...trees, state: 'blocked', requiredGameVersion: '1.6.*' },
          makeMod({
            paradoxModId: 20,
            name: 'Roads',
            state: 'unknown',
            requiredGameVersion: '1.6.*'
          })
        ]
      });

      renderTab(shared);

      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Removed]')
      ).toBeDefined();
      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Blocked]')
      ).toBeDefined();
      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Unavailable]')
      ).toBeDefined();
      expect(screen.queryByText('1.6.*')).toBeNull();
    });

    it(`opens a mod's page when its row is clicked`, async () => {
      setBinding(SLIDESHOW, 'playset', {
        screenshotId: 's0',
        status: 'loaded',
        mods: [traffic]
      });

      renderTab(shared);

      await userEvent.setup().click(screen.getByText('Traffic'));

      expect(getTriggers()).toContainEqual({
        event: 'hallOfFame.common.openModPage',
        args: [traffic.paradoxModId]
      });
    });

    it(`says the playset failed to load, and retries on demand`, async () => {
      setBinding(SLIDESHOW, 'playset', { screenshotId: 's0', status: 'failed', mods: [] });

      renderTab(shared);

      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Load Error]')
      ).toBeDefined();

      await userEvent
        .setup()
        .click(screen.getByText('HallOfFame.UI.Menu.MenuControls.ACTION[Retry]'));

      expect(loadTriggers()).toEqual(['s0', 's0']);
    });

    it(`says none of its mods are available anymore when the loaded list is empty`, () => {
      setBinding(SLIDESHOW, 'playset', { screenshotId: 's0', status: 'loaded', mods: [] });

      renderTab(shared);

      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[None Available]')
      ).toBeDefined();
    });

    it(`says no mods were recorded, without asking for any, when it lists none`, () => {
      renderTab({ ...shared, paradoxModIds: [] });

      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Not Recorded]')
      ).toBeDefined();
      expect(loadTriggers()).toEqual([]);
    });

    it(`says the creator did not share it, without asking for it`, () => {
      renderTab({ ...shared, shareParadoxModIds: false });

      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Not Shared]')
      ).toBeDefined();
      expect(loadTriggers()).toEqual([]);
    });

    it(`addresses the creator viewing their own unshared playset`, () => {
      renderTab(
        { ...shared, shareParadoxModIds: false, creator: makeCreator({ id: 'me' }) },
        { publicCreatorId: 'me' }
      );

      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Not Shared By You]')
      ).toBeDefined();
    });

    it(`says the screenshot predates playsets, without asking for one`, () => {
      renderTab({ ...shared, capabilities: [] });

      expect(
        screen.getByText('HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Predates Feature]')
      ).toBeDefined();
      expect(loadTriggers()).toEqual([]);
    });
  });
});
