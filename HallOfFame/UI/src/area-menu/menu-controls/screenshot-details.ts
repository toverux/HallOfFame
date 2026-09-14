import type { Screenshot } from '../../common';

/**
 * What a details tab shows: the data itself, or which of the two reasons explains its absence.
 */
export type DetailsTabState =
  | { readonly kind: 'content'; readonly text: string }
  | { readonly kind: 'notShared' }
  | { readonly kind: 'predatesFeature' };

/**
 * The display decisions for a screenshot's details, for both the details window and the controls
 * row that opens it.
 */
export interface ScreenshotDetails {
  readonly description: DetailsTabState;

  /**
   * The controls row, `undefined` when it is hidden.
   */
  readonly row: DetailsRow | undefined;
}

export interface DetailsRow {
  /**
   * The description's first line, still in markdown: the row renders it with the game's renderer.
   */
  readonly preview: string;
}

/**
 * Decides what the details window and the controls row show for a screenshot.
 *
 * An empty description means the creator wrote none, unless the screenshot predates the mod
 * release capturing descriptions, which its capabilities tell.
 */
export function selectScreenshotDetails(
  screenshot: Pick<Screenshot, 'description' | 'capabilities'>
): ScreenshotDetails {
  if (screenshot.description) {
    return {
      description: { kind: 'content', text: screenshot.description },
      row: { preview: firstLine(screenshot.description) }
    };
  }

  return {
    description: screenshot.capabilities.includes('description')
      ? { kind: 'notShared' }
      : { kind: 'predatesFeature' },
    row: undefined
  };
}

/**
 * The first line the game's paragraphs component would render: it splits on newlines and drops
 * blank lines.
 */
function firstLine(text: string): string {
  return text.split(/\r\n|\r|\n/u).find(line => line.trim() != '') ?? '';
}
