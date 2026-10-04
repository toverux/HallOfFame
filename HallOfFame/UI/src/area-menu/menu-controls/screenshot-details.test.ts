import { describe, expect, it } from 'bun:test';
import type { Screenshot, ScreenshotCapability } from '../../common';
import { makeCreator, makeScreenshot, photoModeCatalog } from '../../testing/fixtures';
import {
  type DetailsContext,
  type PhotoModeSetting,
  type PhotoModeValue,
  type ScreenshotDetails,
  selectScreenshotDetails as selectWithContext,
  toPhotoModeColorSliders
} from './screenshot-details';

// A screenshot uploaded by a mod release capturing every field.
const allCapabilities: readonly ScreenshotCapability[] = [
  'description',
  'shareParadoxModIds',
  'paradoxModIds',
  'shareRenderSettings',
  'renderSettings'
];

// A screenshot uploaded before the share choices and descriptions, but after playsets and photo
// mode settings were captured.
const preShareCapabilities: readonly ScreenshotCapability[] = ['paradoxModIds', 'renderSettings'];

// Any playset at all, its content irrelevant to the row.
const playset: readonly number[] = [1];

// Any photo mode setting off the game's defaults, its value irrelevant to the row.
const photoModeSettings: Readonly<Record<string, string>> = { 'dof.focusDistance': '3' };

// The server sends `null` for a missing description, which reaches the UI as `undefined` although
// `Screenshot.description` is a `string`.
const missingDescription = undefined as unknown as string;

// A viewer who is not the creator of any screenshot below.
const viewer: DetailsContext = { photoModeCatalog, viewerCreatorId: 'viewer' };

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
          paradoxModIds: playset
        })
      );

      expect(details.row).toEqual({
        preview: undefined,
        hasPhotoModeSettings: false,
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
          paradoxModIds: playset
        })
      );

      expect(details.row).toEqual({
        preview: undefined,
        hasPhotoModeSettings: false,
        hasPlayset: true
      });
    });

    it(`shows no icon beside a description when nothing else is attached`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ description: 'A city.', capabilities: allCapabilities })
      );

      expect(details.row).toEqual({
        preview: 'A city.',
        hasPhotoModeSettings: false,
        hasPlayset: false
      });
    });

    it(`shows both icons beside a description when everything is attached`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          description: 'A city.',
          capabilities: allCapabilities,
          paradoxModIds: playset,
          shareRenderSettings: true,
          renderSettings: photoModeSettings
        })
      );

      expect(details.row).toEqual({
        preview: 'A city.',
        hasPhotoModeSettings: true,
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
        hasPhotoModeSettings: true,
        hasPlayset: false
      });
    });

    it(`shows only icons without a description when a playset is attached`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ capabilities: allCapabilities, paradoxModIds: playset })
      );

      expect(details.row).toEqual({
        preview: undefined,
        hasPhotoModeSettings: false,
        hasPlayset: true
      });
    });

    it(`shows the attached kinds of a screenshot predating descriptions`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({
          capabilities: preShareCapabilities,
          paradoxModIds: playset,
          shareRenderSettings: true,
          renderSettings: photoModeSettings
        })
      );

      expect(details.row).toEqual({
        preview: undefined,
        hasPhotoModeSettings: true,
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

      expect(details.row).toMatchObject({ hasPhotoModeSettings: false });
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

      expect(details.row).toMatchObject({ hasPhotoModeSettings: false });
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
        { photoModeCatalog, viewerCreatorId: undefined }
      );

      expect(details.photoModeSettings).toEqual({ kind: 'notShared', isViewerCreator: false });
    });

    it(`says the game's default settings were used when none were switched on`, () => {
      const details = selectScreenshotDetails(
        makeScreenshot({ capabilities: allCapabilities, shareRenderSettings: true })
      );

      expect(details.photoModeSettings).toEqual({ kind: 'sharedEmpty' });
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

      expect(details.photoModeSettings).toEqual({
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

      expect(details.photoModeSettings).toEqual({
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
        { photoModeCatalog: [], viewerCreatorId: 'viewer' }
      );

      expect(details.photoModeSettings).toMatchObject({
        kind: 'content',
        groups: [{ id: undefined }]
      });
    });
  });
});

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
