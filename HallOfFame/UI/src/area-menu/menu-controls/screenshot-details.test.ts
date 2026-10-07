import { describe, expect, it } from 'bun:test';
import type { Mod, RenderConditionValue, Screenshot, ScreenshotCapability } from '../../common';
import {
  makeCreator,
  makeMod,
  makeScreenshot,
  makeSkyveVerdict,
  photoModeCatalog
} from '../../testing/fixtures';
import {
  type DetailsContext,
  type PhotoModeConditions,
  type PhotoModeSetting,
  type PhotoModeValue,
  type PlaysetTabState,
  type ScreenshotDetails,
  formatClockTime,
  isOlderGameVersion,
  type ModHints,
  selectModHints,
  selectScreenshotDetails as selectWithContext,
  toPhotoModeColorSliders
} from './screenshot-details';

// A screenshot uploaded by a mod release capturing every field.
const allCapabilities: readonly ScreenshotCapability[] = [
  'description',
  'shareParadoxModIds',
  'paradoxModIds',
  'shareRenderSettings',
  'renderSettings',
  'renderConditions'
];

// A screenshot uploaded before the share choices and descriptions, but after playsets and photo
// mode settings were captured.
const preShareCapabilities: readonly ScreenshotCapability[] = ['paradoxModIds', 'renderSettings'];

// Any playset at all, its content irrelevant to the row.
const playset: readonly number[] = [1];

// Any photo mode setting off the game's defaults, its value irrelevant to the row.
const photoModeSettings: Readonly<Record<string, string>> = { 'dof.focusDistance': '3' };

// The conditions of a shot in summer daylight, as the mod records them, with names the block does
// not show.
const recordedConditions: Readonly<Record<string, RenderConditionValue>> = {
  'time.hour': 14.5,
  'time.isOverridden': false,
  'map.latitude': 45,
  'climate.season': 'Summer',
  'climate.weather': 'Scattered',
  'climate.temperature': 21.5,
  'sun.elevation': 52.3,
  'light.dayPhase': 'Day',
  'post.exposure': 0.75,
  'post.temperature': 15,
  'post.tint': 0,
  'options.dayNightVisuals': true,
  'camera.fieldOfView': 60
};

// The server sends `null` for a missing description, which reaches the UI as `undefined` although
// `Screenshot.description` is a `string`.
const missingDescription = undefined as unknown as string;

// A viewer who is not the creator of any screenshot below.
const viewer: DetailsContext = { photoModeCatalog, viewerCreatorId: 'viewer', playset: undefined };

function selectScreenshotDetails(
  screenshot: Screenshot,
  context: DetailsContext = viewer
): ScreenshotDetails {
  return selectWithContext(screenshot, context);
}

describe('selectScreenshotDetails', () => {
  describe('description tab', () => {
    it(`shows the description when there is one`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ description: 'A **city**.', capabilities: ['description'] })
      );

      expect(details.description).toEqual({ kind: 'content', text: 'A **city**.' });
    });

    it(`says the creator shared nothing when the screenshot could have carried one`, () => {
      const details = selectScreenshotDetails(makeScreenshot({ capabilities: ['description'] }));

      expect(details.description).toEqual({ kind: 'notShared' });
    });

    it(`says the creator shared nothing when the description arrives without a value`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ description: missingDescription, capabilities: ['description'] })
      );

      expect(details.description).toEqual({ kind: 'notShared' });
    });

    it(`says the creator shared nothing when the description draws no text`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ description: '# <br>', capabilities: ['description'] })
      );

      expect(details.description).toEqual({ kind: 'notShared' });
    });

    it(`says the screenshot predates descriptions when it could not have carried one`, () => {
      const details = selectScreenshotDetails(makeScreenshot({ capabilities: [] }));

      expect(details.description).toEqual({ kind: 'predatesFeature' });
    });
  });

  describe('controls row', () => {
    it(`is hidden when nothing is attached, the creator having shared nothing`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ capabilities: allCapabilities, shareRenderSettings: false })
      );

      expect(details.row).toBeUndefined();
    });

    it(`is hidden when nothing is attached, the screenshot predating every feature`, () => {
      expect(selectScreenshotDetails(makeScreenshot({ capabilities: [] })).row).toBeUndefined();
    });

    it(`previews the first line as plain text, its markdown stripped`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          description: '## My **city**, **its** story<br>Told.\nMore.',
          capabilities: allCapabilities
        })
      );

      expect(details.row?.preview).toBe('My city, its story');
    });

    it(`keeps what the game's renderer would not read as markdown`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ description: '#1 city, 5 * 3 **stars', capabilities: allCapabilities })
      );

      expect(details.row?.preview).toBe('#1 city, 5 * 3 **stars');
    });

    it(`skips blank lines, which the game's renderer drops too`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ description: '\n  \r\nIts story.\nMore.', capabilities: allCapabilities })
      );

      expect(details.row?.preview).toBe('Its story.');
    });

    it(`shows only icons for a screenshot sent without a description`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          description: missingDescription,
          capabilities: allCapabilities,
          paradoxModIds: playset,
          shareParadoxModIds: true
        })
      );

      expect(details.row).toEqual({
        preview: undefined,
        hasPhotoMode: false,
        hasPlayset: true
      });
    });

    it(`is hidden when the description draws no text and nothing else is attached`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ description: '# <br>', capabilities: allCapabilities })
      );

      expect(details.row).toBeUndefined();
    });

    it(`shows only icons when the description draws no text`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          description: '<br>',
          capabilities: allCapabilities,
          paradoxModIds: playset,
          shareParadoxModIds: true
        })
      );

      expect(details.row).toEqual({
        preview: undefined,
        hasPhotoMode: false,
        hasPlayset: true
      });
    });

    it(`shows no icon beside a description when nothing else is attached`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ description: 'A city.', capabilities: allCapabilities })
      );

      expect(details.row).toEqual({
        preview: 'A city.',
        hasPhotoMode: false,
        hasPlayset: false
      });
    });

    it(`shows both icons beside a description when everything is attached`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          description: 'A city.',
          capabilities: allCapabilities,
          paradoxModIds: playset,
          shareParadoxModIds: true,
          shareRenderSettings: true,
          renderSettings: photoModeSettings
        })
      );

      expect(details.row).toEqual({
        preview: 'A city.',
        hasPhotoMode: true,
        hasPlayset: true
      });
    });

    it(`shows only icons without a description when photo mode settings are attached`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: allCapabilities,
          shareRenderSettings: true,
          renderSettings: photoModeSettings
        })
      );

      expect(details.row).toEqual({
        preview: undefined,
        hasPhotoMode: true,
        hasPlayset: false
      });
    });

    it(`shows only icons without a description when a playset is attached`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: allCapabilities,
          shareParadoxModIds: true,
          paradoxModIds: playset
        })
      );

      expect(details.row).toEqual({
        preview: undefined,
        hasPhotoMode: false,
        hasPlayset: true
      });
    });

    it(`shows the attached kinds of a screenshot predating descriptions`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: preShareCapabilities,
          paradoxModIds: playset,
          shareParadoxModIds: true,
          shareRenderSettings: true,
          renderSettings: photoModeSettings
        })
      );

      expect(details.row).toEqual({
        preview: undefined,
        hasPhotoMode: true,
        hasPlayset: true
      });
    });

    it(`shows no photo mode icon for unshared settings sent to their own creator`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          description: 'A city.',
          capabilities: allCapabilities,
          shareRenderSettings: false,
          renderSettings: photoModeSettings,
          creator: makeCreator({ id: 'viewer' })
        })
      );

      expect(details.row).toMatchObject({ hasPhotoMode: false });
    });

    it(`shows no playset icon for an unshared playset sent to its own creator`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          description: 'A city.',
          capabilities: allCapabilities,
          shareParadoxModIds: false,
          paradoxModIds: playset,
          creator: makeCreator({ id: 'viewer' })
        })
      );

      expect(details.row).toMatchObject({ hasPlayset: false });
    });

    it(`shows the photo mode icon for conditions with no setting switched on`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          description: 'A city.',
          capabilities: allCapabilities,
          shareRenderSettings: true,
          renderConditions: recordedConditions
        })
      );

      expect(details.row).toMatchObject({ hasPhotoMode: true });
    });

    it(`shows no icon for photo mode settings left at the game's defaults`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          description: 'A city.',
          capabilities: allCapabilities,
          shareRenderSettings: true,
          renderSettings: {}
        })
      );

      expect(details.row).toMatchObject({ hasPhotoMode: false });
    });
  });

  describe('photo mode settings tab', () => {
    it(`says the screenshot predates photo mode settings when it could not carry them`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ capabilities: ['description'], shareRenderSettings: true })
      );

      expect(details.photoModeSettings).toEqual({ kind: 'predatesFeature' });
    });

    it(`says the creator did not share them, although they arrived`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: allCapabilities,
          shareRenderSettings: false,
          renderSettings: photoModeSettings
        })
      );

      expect(details.photoModeSettings).toEqual({ kind: 'notShared', isViewerCreator: false });
    });

    it(`addresses the creator viewing their own unshared settings`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: allCapabilities,
          shareRenderSettings: false,
          renderSettings: photoModeSettings,
          creator: makeCreator({ id: 'viewer' })
        })
      );

      expect(details.photoModeSettings).toEqual({ kind: 'notShared', isViewerCreator: true });
    });

    it(`does not take a viewer whose creator ID is unknown for the creator`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ capabilities: allCapabilities, creator: makeCreator({ id: 'viewer' }) }),
        { ...viewer, viewerCreatorId: undefined }
      );

      expect(details.photoModeSettings).toEqual({ kind: 'notShared', isViewerCreator: false });
    });

    it(`says the game's default settings were used when none were switched on`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ capabilities: allCapabilities, shareRenderSettings: true })
      );

      expect(details.photoModeSettings).toEqual({ kind: 'sharedEmpty', conditions: undefined });
    });

    it(`lists the settings of a screenshot predating the share choice, public back then`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: preShareCapabilities,
          shareRenderSettings: true,
          renderSettings: { 'Time of Day': '12' }
        })
      );

      expect(details.photoModeSettings.kind).toBe('content');
    });

    it(`groups the settings by tab and section, in the game's order, leaving out empty ones`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: allCapabilities,
          shareRenderSettings: true,
          renderSettings: {
            'Time of Day': '9.5',
            'WhiteBalance.temperature': '-12.25',
            'PhotoModeRenderSystem.focalLength': '50',
            'PhotoModeRenderSystem.iso': '400'
          }
        })
      );

      expect(details.photoModeSettings).toMatchObject({
        kind: 'content',
        groups: [
          {
            id: 'Camera',
            sections: [
              {
                id: 'CameraBody',
                settings: [
                  {
                    code: 'PhotoModeRenderSystem.iso',
                    value: { kind: 'number', value: 400, fractionDigits: 0 },
                    noteId: undefined
                  }
                ]
              },
              {
                id: 'CameraLens',
                settings: [
                  {
                    code: 'PhotoModeRenderSystem.focalLength',
                    value: { kind: 'number', value: 50, fractionDigits: 3 },
                    noteId: undefined
                  }
                ]
              }
            ]
          },
          {
            id: 'Color',
            sections: [
              {
                id: 'WhiteBalance',
                settings: [
                  {
                    code: 'WhiteBalance.temperature',
                    value: { kind: 'number', value: -12.25, fractionDigits: 3 },
                    noteId:
                      'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[White Balance Note]'
                  }
                ]
              }
            ]
          },
          {
            id: 'Environment',
            sections: [
              {
                id: undefined,
                settings: [
                  {
                    code: 'Time of Day',
                    value: { kind: 'number', value: 9.5, fractionDigits: 3 },
                    noteId:
                      'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Time Of Day Note]'
                  }
                ]
              }
            ]
          }
        ]
      });
    });

    it(`names an enum's option, and keeps the number of an option the game lacks`, () => {
      expect(
        settingValues({ 'PhotoModeRenderSystem.gateFitMode': '2' }).get(
          'PhotoModeRenderSystem.gateFitMode'
        )
      ).toEqual({ kind: 'enum', enumType: 'GateFitMode', option: 'Horizontal', value: 2 });

      expect(
        settingValues({ 'PhotoModeRenderSystem.gateFitMode': '7' }).get(
          'PhotoModeRenderSystem.gateFitMode'
        )
      ).toEqual({ kind: 'enum', enumType: 'GateFitMode', option: undefined, value: 7 });
    });

    it(`reads a checkbox as on or off`, () => {
      expect(settingValues({ 'Vignette.rounded': '1' }).get('Vignette.rounded')).toEqual({
        kind: 'checkbox',
        isOn: true
      });

      expect(settingValues({ 'Vignette.rounded': '0' }).get('Vignette.rounded')).toEqual({
        kind: 'checkbox',
        isOn: false
      });
    });

    it(`reassembles a color from its channels into one setting, alpha only where stored`, () => {
      const values = settingValues({
        'Vignette.color/r': '1',
        'Vignette.color/g': '0.5',
        'Vignette.color/b': '0',
        'Fog.albedo/r': '0.2',
        'Fog.albedo/g': '0.4',
        'Fog.albedo/b': '0.6',
        'Fog.albedo/a': '0.8'
      });

      expect([...values.keys()]).toEqual(['Vignette.color', 'Fog.albedo']);

      expect(values.get('Vignette.color')).toEqual({
        kind: 'color',
        red: 1,
        green: 0.5,
        blue: 0,
        alpha: undefined
      });

      expect(values.get('Fog.albedo')).toEqual({
        kind: 'color',
        red: 0.2,
        green: 0.4,
        blue: 0.6,
        alpha: 0.8
      });
    });

    it(`lists a vector's components in one setting`, () => {
      const values = settingValues({
        'PhotoModeRenderSystem.sensorSize/y': '18.669',
        'PhotoModeRenderSystem.sensorSize/x': '24.892'
      });

      expect(values.get('PhotoModeRenderSystem.sensorSize')).toEqual({
        kind: 'vector',
        components: [
          { name: 'x', value: 24.892 },
          { name: 'y', value: 18.669 }
        ],
        fractionDigits: 3
      });
    });

    it(`wraps a Time of Day past midnight to the hour the sun was drawn at`, () => {
      expect(settingValues({ 'Time of Day': '100.5' }).get('Time of Day')).toEqual({
        kind: 'number',
        value: 4.5,
        fractionDigits: 3
      });
    });

    it(`notes a run of settings sharing a note once, under its last setting`, () => {
      const noteIds = listedSettings({
        'ColorAdjustments.postExposure': '1',
        'WhiteBalance.temperature': '10',
        'WhiteBalance.tint': '5',
        'Time of Day': '12'
      }).map(setting => [setting.code, setting.noteId]);

      expect(noteIds).toEqual([
        [
          'ColorAdjustments.postExposure',
          'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Post Exposure Note]'
        ],
        ['WhiteBalance.temperature', undefined],
        [
          'WhiteBalance.tint',
          'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[White Balance Note]'
        ],
        [
          'Time of Day',
          'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Time Of Day Note]'
        ]
      ]);
    });

    it(`puts a code missing from the catalog in a last "Other" group, raw`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: allCapabilities,
          shareRenderSettings: true,
          renderSettings: { 'Env.TimeOfDayEase': '0.25', 'Time of Day': '12' }
        })
      );

      expect(details.photoModeSettings).toMatchObject({
        kind: 'content',
        groups: [
          {
            id: 'Environment',
            sections: [
              {
                id: undefined,
                settings: [
                  {
                    code: 'Time of Day',
                    value: { kind: 'number', value: 12, fractionDigits: 3 },
                    noteId:
                      'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Time Of Day Note]'
                  }
                ]
              }
            ]
          },
          {
            id: undefined,
            sections: [
              {
                id: undefined,
                settings: [
                  {
                    code: 'Env.TimeOfDayEase',
                    value: { kind: 'number', value: 0.25, fractionDigits: undefined },
                    noteId: undefined
                  }
                ]
              }
            ]
          }
        ]
      });
    });

    it(`puts every code in "Other" while the catalog is unknown`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: allCapabilities,
          shareRenderSettings: true,
          renderSettings: { 'Time of Day': '12' }
        }),
        { ...viewer, photoModeCatalog: [] }
      );

      expect(details.photoModeSettings).toMatchObject({
        kind: 'content',
        groups: [{ id: undefined }]
      });
    });
  });

  describe('conditions block', () => {
    it(`shows the scene and the light the shot was taken in`, () => {
      expect(conditionsOf({}, recordedConditions)).toEqual({
        time: { kind: 'clock', hour: 14.5, latitude: 45 },
        season: 'Summer',
        weather: 'Scattered',
        isNight: false,
        temperature: 21.5,
        sunElevation: 52.3,
        gameChosen: [
          gameChosen({ code: 'ColorAdjustments.postExposure', value: 0.75 }),
          gameChosen({ code: 'WhiteBalance.temperature', value: 15 })
        ],
        isRecorded: true
      });
    });

    it(`hides a game-chosen tint of 0, which every vanilla climate picks`, () => {
      for (const { tint, isShown } of [
        { tint: 0, isShown: false },
        { tint: 5, isShown: true }
      ]) {
        const conditions = conditionsOf({}, { ...recordedConditions, 'post.tint': tint });

        expect(conditions?.gameChosen.some(setting => setting.code == 'WhiteBalance.tint')).toBe(
          isShown
        );
      }
    });

    it(`leaves out the exposure and white balance the creator set, listed as settings`, () => {
      expect(
        conditionsOf(
          { 'ColorAdjustments.postExposure': '1', 'WhiteBalance.temperature': '20' },
          { ...recordedConditions, 'post.tint': 5 }
        )
      ).toMatchObject({ gameChosen: [gameChosen({ code: 'WhiteBalance.tint', value: 5 })] });
    });

    it(`tells night from day the way the game's climate widget does`, () => {
      for (const { dayPhase, isNight } of [
        { dayPhase: 'Dawn', isNight: true },
        { dayPhase: 'Sunrise', isNight: false },
        { dayPhase: 'Sunset', isNight: false },
        { dayPhase: 'Dusk', isNight: true },
        { dayPhase: 'Night', isNight: true }
      ]) {
        expect(
          conditionsOf({}, { ...recordedConditions, 'light.dayPhase': dayPhase })
        ).toMatchObject({ isNight });
      }
    });

    it(`says Day/Night visuals was off in place of the hour and the latitude`, () => {
      expect(
        conditionsOf({}, { ...recordedConditions, 'options.dayNightVisuals': false })
      ).toMatchObject({ time: { kind: 'dayNightVisualsOff' }, sunElevation: 52.3 });
    });

    it(`shows the hour and the latitude the creator set, Day/Night visuals off or not`, () => {
      expect(
        conditionsOf(
          { 'Time of Day': '18' },
          {
            ...recordedConditions,
            'time.hour': 18,
            'time.isOverridden': true,
            'options.dayNightVisuals': false
          }
        )
      ).toMatchObject({ time: { kind: 'clock', hour: 18, latitude: 45 } });
    });

    it(`wraps a recorded hour past midnight, as the stored Time of Day`, () => {
      expect(
        conditionsOf({}, { ...recordedConditions, 'time.hour': 100.5, 'time.isOverridden': true })
      ).toMatchObject({ time: { kind: 'clock', hour: 4.5 } });
    });

    it(`shows only the stored hour for a screenshot predating the conditions`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: allCapabilities.filter(capability => capability != 'renderConditions'),
          shareRenderSettings: true,
          renderSettings: { 'Time of Day': '100.5' },
          // A stray map the capability does not vouch for.
          renderConditions: recordedConditions
        })
      );

      expect(details.photoModeSettings).toMatchObject({
        conditions: onlyTime({ kind: 'clock', hour: 4.5, latitude: undefined })
      });
    });

    it(`shows only the stored hour when the conditions are missing`, () => {
      expect(conditionsOf({ 'Time of Day': '9' }, {})).toEqual(
        onlyTime({ kind: 'clock', hour: 9, latitude: undefined })
      );
    });

    it(`is absent when nothing of it is known`, () => {
      expect(conditionsOf({ 'Vignette.rounded': '1' }, {})).toBeUndefined();
    });

    it(`ignores the names it does not know, and values of another type`, () => {
      expect(
        conditionsOf(
          {},
          {
            'time.hour': '14',
            'climate.season': 3,
            'climate.weather': 'Meteor Shower',
            'sun.elevation': 30,
            'some.future.condition': 1
          }
        )
      ).toEqual({ ...onlyTime(), sunElevation: 30, isRecorded: true });
    });

    it(`shows in the shared-but-empty state, beside the default settings`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: allCapabilities,
          shareRenderSettings: true,
          renderConditions: recordedConditions
        })
      );

      expect(details.photoModeSettings).toMatchObject({
        kind: 'sharedEmpty',
        conditions: { season: 'Summer' }
      });
    });

    it(`is withheld with the settings when the creator did not share them`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: allCapabilities,
          shareRenderSettings: false,
          renderConditions: recordedConditions
        })
      );

      expect(details.photoModeSettings).toEqual({ kind: 'notShared', isViewerCreator: false });
    });
  });

  describe('playset tab', () => {
    // The playset's mods, as the server returns them, most subscribed first.
    const playsetMods = [
      makeMod({ paradoxModId: 30, subscribersCount: 900 }),
      makeMod({ paradoxModId: 20, subscribersCount: 40 }),
      makeMod({ paradoxModId: 10, subscribersCount: 5 })
    ];

    const modIds = playsetMods.map(mod => mod.paradoxModId);

    // A shared playset listing three mods, as the window receives it.
    const shared = makeScreenshot({
      id: 's0',
      capabilities: allCapabilities,
      shareParadoxModIds: true,
      paradoxModIds: modIds
    });

    function withPlayset(state: DetailsContext['playset']): DetailsContext {
      return { ...viewer, playset: state };
    }

    it(`says the screenshot predates playsets when it could not carry one`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ capabilities: [], shareParadoxModIds: true })
      );

      expect(details.playset).toEqual({ kind: 'predatesFeature' });
      expect(details.shouldLoadPlayset).toBe(false);
    });

    it(`says the creator did not share it, although its mod IDs arrived`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: allCapabilities,
          shareParadoxModIds: false,
          paradoxModIds: modIds
        })
      );

      expect(details.playset).toEqual({ kind: 'notShared', isViewerCreator: false });
      expect(details.shouldLoadPlayset).toBe(false);
    });

    it(`addresses the creator viewing their own unshared playset`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: allCapabilities,
          shareParadoxModIds: false,
          paradoxModIds: modIds,
          creator: makeCreator({ id: 'viewer' })
        })
      );

      expect(details.playset).toEqual({ kind: 'notShared', isViewerCreator: true });
    });

    it(`lists a playset predating the share choice, public back then`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: preShareCapabilities,
          shareParadoxModIds: true,
          paradoxModIds: modIds
        })
      );

      expect(details.shouldLoadPlayset).toBe(true);
    });

    it(`says no mods were recorded when the screenshot lists none, whatever was loaded`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ id: 's0', capabilities: allCapabilities, shareParadoxModIds: true }),
        withPlayset({ screenshotId: 's0', status: 'loaded', mods: playsetMods })
      );

      expect(details.playset).toEqual({ kind: 'sharedEmpty', reason: 'notRecorded' });
      expect(details.shouldLoadPlayset).toBe(false);
    });

    it(`asks for the playset of a shared screenshot listing mod IDs`, () => {
      expect(selectScreenshotDetails(shared).shouldLoadPlayset).toBe(true);
    });

    it(`shows a placeholder per mod ID while nothing answered for this screenshot`, () => {
      const loading: PlaysetTabState = { kind: 'loading', placeholderCount: 3 };

      expect(selectScreenshotDetails(shared).playset).toEqual(loading);

      expect(
        selectScreenshotDetails(
          shared,
          withPlayset({ screenshotId: 's0', status: 'loading', mods: [] })
        ).playset
      ).toEqual(loading);

      // A late answer for another screenshot is not this one's.
      expect(
        selectScreenshotDetails(
          shared,
          withPlayset({ screenshotId: 'other', status: 'loaded', mods: playsetMods })
        ).playset
      ).toEqual(loading);
    });

    it(`says the playset failed to load`, () => {
      const details = selectScreenshotDetails(
        shared,
        withPlayset({ screenshotId: 's0', status: 'failed', mods: [] })
      );

      expect(details.playset).toEqual({ kind: 'failed' });
      expect(details.shouldLoadPlayset).toBe(true);
    });

    it(`lists the loaded mods in the server's order, the left-out ones unmentioned`, () => {
      // The server left out the second mod, which Paradox removed.
      const mods = playsetMods.filter((_, index) => index != 1);

      const details = selectScreenshotDetails(
        shared,
        withPlayset({ screenshotId: 's0', status: 'loaded', mods })
      );

      expect(details.playset).toEqual({ kind: 'content', mods });
    });

    it(`says none of its mods are available anymore when the loaded list is empty`, () => {
      const details = selectScreenshotDetails(
        shared,
        withPlayset({ screenshotId: 's0', status: 'loaded', mods: [] })
      );

      expect(details.playset).toEqual({ kind: 'sharedEmpty', reason: 'noneAvailable' });
    });
  });
});

/**
 * The conditions block of a shared screenshot carrying every capability.
 */
function conditionsOf(
  renderSettings: Readonly<Record<string, string>>,
  renderConditions: Readonly<Record<string, RenderConditionValue>>
): PhotoModeConditions | undefined {
  const { photoModeSettings: tab } = selectScreenshotDetails(
    makeScreenshot({
      capabilities: allCapabilities,
      shareRenderSettings: true,
      renderSettings,
      renderConditions
    })
  );

  return tab.kind == 'content' || tab.kind == 'sharedEmpty' ? tab.conditions : undefined;
}

function onlyTime(time?: PhotoModeConditions['time']): PhotoModeConditions {
  return {
    time,
    season: undefined,
    weather: undefined,
    isNight: undefined,
    temperature: undefined,
    sunElevation: undefined,
    gameChosen: [],
    isRecorded: false
  };
}

/**
 * A value the game chose, as the conditions block lists it, with the fixture catalog's fraction
 * digits.
 */
function gameChosen({ code, value }: Readonly<{ code: string; value: number }>): PhotoModeSetting {
  return { code, value: { kind: 'number', value, fractionDigits: 3 }, noteId: undefined };
}

describe('toPhotoModeColorSliders', () => {
  it(`reads a color as the game picker's hue, saturation, and value sliders`, () => {
    expect(
      toPhotoModeColorSliders({ kind: 'color', red: 0.2, green: 0.4, blue: 0.8, alpha: undefined })
    ).toEqual({ hue: 220, saturation: 75, value: 80, alpha: undefined });
  });

  it(`reads alpha in percent when the color has one`, () => {
    expect(
      toPhotoModeColorSliders({ kind: 'color', red: 1, green: 0, blue: 0.5, alpha: 0.25 })
    ).toEqual({ hue: 330, saturation: 100, value: 100, alpha: 25 });
  });

  it(`reads hue 0 for a grey, and value past 100 for an HDR color`, () => {
    expect(
      toPhotoModeColorSliders({ kind: 'color', red: 1.5, green: 1.5, blue: 1.5, alpha: undefined })
    ).toEqual({ hue: 0, saturation: 0, value: 150, alpha: undefined });
  });

  it(`wraps a hue rounding up to a full turn back to 0`, () => {
    expect(
      toPhotoModeColorSliders({ kind: 'color', red: 1, green: 0, blue: 0.001, alpha: undefined })
        .hue
    ).toBe(0);
  });
});

/**
 * The listed settings of a shared screenshot holding {@link renderSettings}, by code, in order.
 */
function settingValues(
  renderSettings: Readonly<Record<string, string>>
): ReadonlyMap<string, PhotoModeValue> {
  return new Map(listedSettings(renderSettings).map(setting => [setting.code, setting.value]));
}

/**
 * The listed settings of a shared screenshot holding {@link renderSettings}, in order.
 */
function listedSettings(
  renderSettings: Readonly<Record<string, string>>
): readonly PhotoModeSetting[] {
  const details = selectScreenshotDetails(
    makeScreenshot({ capabilities: allCapabilities, shareRenderSettings: true, renderSettings })
  );

  if (details.photoModeSettings.kind != 'content') {
    throw new Error(`Expected listed settings, got ${details.photoModeSettings.kind}.`);
  }

  return details.photoModeSettings.groups.flatMap(group =>
    group.sections.flatMap(section => section.settings)
  );
}

describe('formatClockTime', () => {
  it(`reads an hour as a 24-hour clock, to the minute`, () => {
    for (const { hour, clock } of [
      { hour: 9.5, clock: '09:30' },
      { hour: 14.258, clock: '14:15' }
    ]) {
      expect(formatClockTime(hour)).toBe(clock);
    }
  });

  it(`rounds the last minute of the day over to midnight`, () => {
    const { hour } = { hour: 23.9999 };

    expect(formatClockTime(hour)).toBe('00:00');
  });
});

describe('selectModHints', () => {
  // The vanilla `menu.gameVersion` binding's shape.
  const gameVersion = '1.6.2f1 (8573.1a2b) [2026.09.01.1200]';

  function select(overrides: Partial<Mod> = {}): ModHints {
    return selectModHints(makeMod({ paradoxModId: 1, ...overrides }), gameVersion);
  }

  describe('cell', () => {
    it.each([
      ['stable', 'Stable', 'dimmed'],
      ['stableNoNewFeatures', 'Stable', 'dimmed'],
      ['stableNoFutureUpdates', 'Stable', 'dimmed'],
      ['breaksOnPatch', 'Caution', 'warning'],
      ['numerousReports', 'Caution', 'warning'],
      ['cautionWhenUsing', 'Caution', 'warning'],
      ['hasIssues', 'HasIssues', 'warning'],
      ['hasIssuesNoFutureUpdates', 'HasIssues', 'warning'],
      ['obsolete', 'Obsolete', 'warning'],
      ['broken', 'Broken', 'negative'],
      ['brokenFromPatch', 'Broken', 'negative'],
      ['brokenFromNewVersion', 'Broken', 'negative']
    ] as const)(`files %p under %p, in the %p tone`, (stability, group, tone) => {
      expect(select({ skyve: makeSkyveVerdict({ stability }) }).cell).toEqual({
        labelId: `HallOfFame.Skyve.${group}`,
        tone
      });
    });

    it(`is empty for a mod Skyve has not reviewed`, () => {
      expect(select({ skyve: null }).cell).toBeUndefined();
    });

    it(`is empty for a mod Skyve lacks the information to review`, () => {
      expect(
        select({ skyve: makeSkyveVerdict({ stability: 'notEnoughInformation' }) }).cell
      ).toBeUndefined();
    });

    it(`shows an unpublished mod's state in place of its verdict`, () => {
      const hints = select({ state: 'removed', skyve: makeSkyveVerdict({ stability: 'broken' }) });

      expect(hints.cell).toEqual({
        labelId: 'HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[Removed]',
        tone: 'dimmed'
      });

      // The verdict is still there to read.
      expect(hints.skyve?.labelId).toBe('HallOfFame.Skyve.Broken');
    });

    it.each([
      ['blocked', 'Blocked'],
      ['unknown', 'Unavailable']
    ] as const)(`shows the %p state as %p`, (state, label) => {
      expect(select({ state }).cell?.labelId).toBe(
        `HallOfFame.UI.Menu.ScreenshotDetails.PLAYSET[${label}]`
      );
    });
  });

  describe('a stability value the mod does not know', () => {
    const hints = (): ModHints =>
      select({ skyve: makeSkyveVerdict({ stability: 'brokenOnTuesdays' }) });

    it(`leaves the cell empty`, () => {
      expect(hints().cell).toBeUndefined();
    });

    it(`shows no Skyve block and no card line`, () => {
      expect(hints().skyve).toBeUndefined();
      expect(hints().card).toBeUndefined();
    });
  });

  describe('a mod broken by a patch', () => {
    const brokenFromPatch = makeSkyveVerdict({
      stability: 'brokenFromPatch',
      reviewedAt: '2026-09-15T16:16:02.537Z'
    });

    it(`shows as a caution once released since its review, under the mod's own label`, () => {
      const hints = select({
        skyve: brokenFromPatch,
        knownLastReleasedAt: '2026-09-18T14:48:50.000Z'
      });

      expect(hints.cell).toEqual({ labelId: 'HallOfFame.Skyve.Caution', tone: 'warning' });

      expect(hints.skyve).toMatchObject({
        labelId: 'HallOfFame.UI.Menu.ScreenshotDetails.SKYVE[Broken From Patch Updated]',
        tone: 'warning'
      });
    });

    it(`stays broken when last released before its review`, () => {
      const hints = select({
        skyve: brokenFromPatch,
        knownLastReleasedAt: '2026-09-12T02:40:07.000Z'
      });

      expect(hints.cell).toEqual({ labelId: 'HallOfFame.Skyve.Broken', tone: 'negative' });
      expect(hints.skyve?.labelId).toBe('HallOfFame.Skyve.BrokenFromPatch');
    });

    it(`stays broken when its last release is unknown`, () => {
      const hints = select({ skyve: brokenFromPatch, knownLastReleasedAt: null });

      expect(hints.cell?.tone).toBe('negative');
    });

    it(`stays broken when its review date is unknown`, () => {
      const hints = select({
        skyve: { ...brokenFromPatch, reviewedAt: null, reviewedAtFormattedDistance: null },
        knownLastReleasedAt: '2026-09-18T14:48:50.000Z'
      });

      expect(hints.cell?.tone).toBe('negative');
    });
  });

  describe('Skyve block', () => {
    it(`is absent for a mod Skyve has not reviewed`, () => {
      expect(select({ skyve: null }).skyve).toBeUndefined();
    });

    it(`names Skyve's exact label, in the cell's tone`, () => {
      expect(
        select({ skyve: makeSkyveVerdict({ stability: 'stableNoNewFeatures' }) }).skyve
      ).toMatchObject({
        labelId: 'HallOfFame.Skyve.StableNoNewFeatures',
        tone: 'dimmed'
      });

      expect(
        select({ skyve: makeSkyveVerdict({ stability: 'cautionWhenUsing' }) }).skyve
      ).toMatchObject({
        labelId: 'HallOfFame.Skyve.CautionWhenUsing',
        tone: 'warning'
      });
    });

    it(`is dimmed for a mod Skyve lacks the information to review`, () => {
      expect(
        select({ skyve: makeSkyveVerdict({ stability: 'notEnoughInformation' }) }).skyve
      ).toMatchObject({ labelId: 'HallOfFame.Skyve.NotEnoughInformation', tone: 'dimmed' });
    });

    it(`keeps the reviewer's note whole`, () => {
      const note = 'Known issue:\nSome cranes are rotated.\n\nAnother line.';

      expect(select({ skyve: makeSkyveVerdict({ note }) }).skyve?.note).toBe(note);
      expect(select({ skyve: makeSkyveVerdict({ note: null }) }).skyve?.note).toBeUndefined();
    });

    it(`tells when and on which game version the mod was reviewed`, () => {
      expect(select({ skyve: makeSkyveVerdict() }).skyve?.review).toEqual({
        labelId: 'HallOfFame.UI.Menu.ScreenshotDetails.SKYVE[Reviewed]',
        args: { WHEN: '22 days ago', VERSION: '1.6.2f1' }
      });
    });

    it(`tells only when the mod was reviewed, without a game version`, () => {
      expect(
        select({ skyve: makeSkyveVerdict({ reviewedGameVersion: null }) }).skyve?.review
      ).toEqual({
        labelId: 'HallOfFame.UI.Menu.ScreenshotDetails.SKYVE[Reviewed When]',
        args: { WHEN: '22 days ago' }
      });
    });

    it(`tells only the game version, without a review date`, () => {
      const skyve = makeSkyveVerdict({ reviewedAt: null, reviewedAtFormattedDistance: null });

      expect(select({ skyve }).skyve?.review).toEqual({
        labelId: 'HallOfFame.UI.Menu.ScreenshotDetails.SKYVE[Reviewed On Version]',
        args: { VERSION: '1.6.2f1' }
      });
    });

    it(`has no review line without either`, () => {
      const skyve = makeSkyveVerdict({
        reviewedAt: null,
        reviewedAtFormattedDistance: null,
        reviewedGameVersion: null
      });

      expect(select({ skyve }).skyve?.review).toBeUndefined();
    });
  });

  describe('game version line', () => {
    it(`is absent for a mod naming no game version`, () => {
      expect(select({ requiredGameVersion: null }).gameVersion).toBeUndefined();
    });

    it(`flags a game version older than the running game's`, () => {
      expect(select({ requiredGameVersion: '1.3.*' }).gameVersion).toEqual({
        version: '1.3.*',
        isOlder: true
      });
    });

    it(`does not flag the running game's version`, () => {
      expect(select({ requiredGameVersion: '1.6.*' }).gameVersion).toEqual({
        version: '1.6.*',
        isOlder: false
      });
    });
  });

  describe('showcased mod card', () => {
    it(`has no Skyve line for a mod Skyve has not reviewed`, () => {
      expect(select({ skyve: null }).card).toBeUndefined();
    });

    it(`has no Skyve line for a mod Skyve lacks the information to review`, () => {
      expect(
        select({ skyve: makeSkyveVerdict({ stability: 'notEnoughInformation' }) }).card
      ).toBeUndefined();
    });

    it(`has a Skyve line telling the verdict, without a tooltip for a stable mod`, () => {
      const hints = select({ skyve: makeSkyveVerdict({ stability: 'stableNoFutureUpdates' }) });

      expect(hints.card?.block).toBe(hints.skyve);
      expect(hints.card?.hasTooltip).toBe(false);
    });

    it.each(['cautionWhenUsing', 'hasIssues', 'obsolete', 'broken', 'brokenFromNewVersion'])(
      `has a Skyve line and a tooltip for %p`,
      stability => {
        expect(select({ skyve: makeSkyveVerdict({ stability }) }).card?.hasTooltip).toBe(true);
      }
    );
  });
});

describe('isOlderGameVersion', () => {
  // The vanilla `menu.gameVersion` binding's shape.
  const gameVersion = '1.6.2f1 (8573.1a2b) [2026.09.01.1200]';

  it.each(['1.3.*', '1.1.12*', '1.5.0f1*', '0.9.*'])(
    'is true for %p, whose major.minor is older',
    target => {
      expect(isOlderGameVersion(target, gameVersion)).toBe(true);
    }
  );

  it.each(['1.6.*', '1.6.2', '1.6.0f1*', '1.7.*', '2.0.*'])(
    'is false for %p, made for this game version or a newer one',
    target => {
      expect(isOlderGameVersion(target, gameVersion)).toBe(false);
    }
  );

  it.each(['1.*', '1*', '*.*.*', '', 'latest'])(
    'is false for %p, which names no minor version',
    target => {
      expect(isOlderGameVersion(target, gameVersion)).toBe(false);
    }
  );

  it('is false when the game version cannot be read', () => {
    expect(isOlderGameVersion('1.3.*', '')).toBe(false);
  });
});
