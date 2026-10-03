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
   * The description's first line as plain text: Cohtml only ellipsizes a text box laid out as a
   * column, which would stack the runs the game's markdown renderer splits a line into.
   * `undefined` when the description draws no text, the row then being only icons.
   */
  readonly preview: string | undefined;

  readonly hasPhotoModeSettings: boolean;

  readonly hasPlayset: boolean;
}

/**
 * Decides what the details window and the controls row show for a screenshot.
 *
 * A description that draws no text means the creator wrote none, unless the screenshot predates
 * the mod release capturing descriptions, which its capabilities tell.
 *
 * The row shows a kind of data only when there is some to show: the server blanks what the creator
 * did not share, and a screenshot predating a kind holds it blank too, so neither needs its own
 * check here.
 */
export function selectScreenshotDetails(
  screenshot: Pick<Screenshot, 'description' | 'capabilities' | 'paradoxModIds' | 'renderSettings'>
): ScreenshotDetails {
  // Guarded rather than trusting the type: the server sends `null` for a screenshot without a
  // description, which reaches the UI as `undefined`.
  const preview = screenshot.description ? previewLine(screenshot.description) : undefined;

  // A description that draws no text is no description, in the window as in the row.
  const description: DetailsTabState =
    preview == undefined
      ? screenshot.capabilities.includes('description')
        ? { kind: 'notShared' }
        : { kind: 'predatesFeature' }
      : { kind: 'content', text: screenshot.description };

  const hasPhotoModeSettings = Object.keys(screenshot.renderSettings).length > 0;

  const hasPlayset = screenshot.paradoxModIds.length > 0;

  const isRowShown = preview != undefined || hasPhotoModeSettings || hasPlayset;

  return {
    description,
    row: isRowShown ? { preview, hasPhotoModeSettings, hasPlayset } : undefined
  };
}

/**
 * A description's first line as plain text, for the row's preview.
 *
 * The game's paragraphs component splits on newlines and drops blank paragraphs, and its markdown
 * renderer reads leading hashes as a heading and `**` pairs as bold: those forms are stripped,
 * anything else being kept as written.
 * The preview also stops at a `<br>`, on purpose, though the renderer draws one as a space.
 * `undefined` when no line holds any text.
 */
function previewLine(text: string): string | undefined {
  const lines = text
    .split(/\r\n|\r|\n/u)
    .flatMap(paragraph => paragraph.replace(/^#+\s+/u, '').split(/<br>/iu))
    .map(line => line.replaceAll(/\*\*(?<text>.+?)\*\*/gu, '$<text>').trim());

  return lines.find(line => line != '');
}
