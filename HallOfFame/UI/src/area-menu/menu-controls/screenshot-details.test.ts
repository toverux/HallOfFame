import { describe, expect, it } from 'bun:test';
import { selectScreenshotDetails } from './screenshot-details';

describe('selectScreenshotDetails', () => {
  describe('description tab', () => {
    it(`shows the description when there is one`, () => {
      const details = selectScreenshotDetails({
        description: 'A **city**.',
        capabilities: ['description']
      });

      expect(details.description).toEqual({ kind: 'content', text: 'A **city**.' });
    });

    it(`says the creator shared nothing when the screenshot could have carried one`, () => {
      const details = selectScreenshotDetails({ description: '', capabilities: ['description'] });

      expect(details.description).toEqual({ kind: 'notShared' });
    });

    it(`says the screenshot predates descriptions when it could not have carried one`, () => {
      const details = selectScreenshotDetails({ description: '', capabilities: [] });

      expect(details.description).toEqual({ kind: 'predatesFeature' });
    });
  });

  describe('controls row', () => {
    it(`is hidden when there is no description`, () => {
      expect(
        selectScreenshotDetails({ description: '', capabilities: ['description'] }).row
      ).toBeUndefined();

      expect(selectScreenshotDetails({ description: '', capabilities: [] }).row).toBeUndefined();
    });

    it(`previews the first line, markdown left for the renderer`, () => {
      const details = selectScreenshotDetails({
        description: '# My **city**\nIts story.',
        capabilities: ['description']
      });

      expect(details.row).toEqual({ preview: '# My **city**' });
    });

    it(`skips blank lines, which the paragraphs component drops too`, () => {
      const details = selectScreenshotDetails({
        description: '\n  \r\nIts story.\nMore.',
        capabilities: ['description']
      });

      expect(details.row).toEqual({ preview: 'Its story.' });
    });
  });
});
