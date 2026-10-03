import { describe, expect, it } from 'bun:test';
import type { ScreenshotCapability } from '../../common';
import { makeScreenshot } from '../../testing/fixtures';
import { selectScreenshotDetails } from './screenshot-details';

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
          renderSettings: photoModeSettings
        })
      );

      expect(details.row).toEqual({
        preview: undefined,
        hasPhotoModeSettings: true,
        hasPlayset: true
      });
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
});
