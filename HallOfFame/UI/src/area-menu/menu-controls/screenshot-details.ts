import type { PhotoModeProperty, Screenshot } from '../../common';

/**
 * What a details tab shows: the data itself, or which of the two reasons explains its absence.
 */
export type DetailsTabState =
  | { readonly kind: 'content'; readonly text: string }
  | { readonly kind: 'notShared' }
  | { readonly kind: 'predatesFeature' };

/**
 * What the photo mode settings tab shows, decided from the share flag and the capabilities, never
 * from whether settings arrived: the server sends a creator their own unshared ones.
 */
export type PhotoModeTabState =
  | { readonly kind: 'content'; readonly groups: readonly PhotoModeGroup[] }
  | { readonly kind: 'notShared'; readonly isViewerCreator: boolean }
  | { readonly kind: 'predatesFeature' }
  // Shared, with no setting switched on: the game's defaults.
  | { readonly kind: 'sharedEmpty' };

/**
 * A photo mode tab's listed settings.
 */
export interface PhotoModeGroup {
  /**
   * The game's tab ID, `undefined` for the last group, holding the codes the catalog lacks.
   */
  readonly id: string | undefined;

  readonly sections: readonly PhotoModeSection[];
}

export interface PhotoModeSection {
  /**
   * The section title's code, `undefined` for settings preceding any title in their tab.
   */
  readonly id: string | undefined;

  readonly settings: readonly PhotoModeSetting[];
}

export interface PhotoModeSetting {
  /**
   * The property's code, a color's or a vector's without its component suffix, which is what the
   * game keys their names with.
   */
  readonly code: string;

  readonly value: PhotoModeValue;

  /**
   * The localization ID of the mod's note shown under the setting, set on the last of a run of
   * settings sharing one note.
   */
  readonly noteId: string | undefined;
}

export type PhotoModeValue =
  | {
      readonly kind: 'number';
      readonly value: number;
      // `undefined` for a code the catalog lacks, shown as stored.
      readonly fractionDigits: number | undefined;
    }
  | {
      readonly kind: 'enum';
      readonly enumType: string;
      // `undefined` for a value naming no option of the enum.
      readonly option: string | undefined;
      readonly value: number;
    }
  | { readonly kind: 'checkbox'; readonly isOn: boolean }
  | {
      readonly kind: 'color';
      readonly red: number;
      readonly green: number;
      readonly blue: number;
      // `undefined` for a color without an alpha channel, which the game keeps opaque.
      readonly alpha: number | undefined;
    }
  | {
      readonly kind: 'vector';
      readonly components: readonly PhotoModeVectorComponent[];
      readonly fractionDigits: number;
    };

export interface PhotoModeVectorComponent {
  // The component's suffix, `x`, `y`...
  readonly name: string;
  readonly value: number;
}

/**
 * What the details depend on besides the screenshot.
 */
export interface DetailsContext {
  /**
   * The game's photo mode properties, empty until the mod has read them.
   */
  readonly photoModeCatalog: readonly PhotoModeProperty[];

  /**
   * The viewer's public creator ID, `undefined` until the mod first logs in.
   */
  readonly viewerCreatorId: string | undefined;
}

/**
 * The display decisions for a screenshot's details, for both the details window and the controls
 * row that opens it.
 */
export interface ScreenshotDetails {
  readonly description: DetailsTabState;

  readonly photoModeSettings: PhotoModeTabState;

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
 * The row shows an icon only for a tab with something to show.
 */
export function selectScreenshotDetails(
  screenshot: Pick<
    Screenshot,
    | 'description'
    | 'capabilities'
    | 'paradoxModIds'
    | 'shareRenderSettings'
    | 'renderSettings'
    | 'creator'
  >,
  context: DetailsContext
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

  const photoModeSettings = selectPhotoModeTab(screenshot, context);

  const hasPhotoModeSettings = photoModeSettings.kind == 'content';

  const hasPlayset = screenshot.paradoxModIds.length > 0;

  const isRowShown = preview != undefined || hasPhotoModeSettings || hasPlayset;

  return {
    description,
    photoModeSettings,
    row: isRowShown ? { preview, hasPhotoModeSettings, hasPlayset } : undefined
  };
}

/**
 * A color as the sliders of the game's photo mode color picker set it, the only way the game
 * offers: hue in degrees, the others in percent, rounded to the sliders' step.
 * Hue reads 0 for a grey, which has none, where the picker leaves its hue slider.
 * Value goes past 100 for an HDR color, past the end of its slider.
 */
export function toPhotoModeColorSliders(
  color: Extract<PhotoModeValue, { kind: 'color' }>
): PhotoModeColorSliders {
  const { red, green, blue, alpha } = color;

  const max = Math.max(red, green, blue);

  const chroma = max - Math.min(red, green, blue);

  return {
    hue: Math.round(hueSixths(color, max, chroma) * DEGREES_PER_SIXTH) % DEGREES_PER_TURN,
    saturation: Math.round((max == 0 ? 0 : chroma / max) * PERCENT),
    value: Math.round(max * PERCENT),
    alpha: alpha == undefined ? undefined : Math.round(alpha * PERCENT)
  };
}

export interface PhotoModeColorSliders {
  readonly hue: number;
  readonly saturation: number;
  readonly value: number;
  // `undefined` for a color without an alpha channel, which the picker shows no slider for.
  readonly alpha: number | undefined;
}

function selectPhotoModeTab(
  screenshot: Pick<
    Screenshot,
    'capabilities' | 'shareRenderSettings' | 'renderSettings' | 'creator'
  >,
  { photoModeCatalog, viewerCreatorId }: DetailsContext
): PhotoModeTabState {
  if (!screenshot.capabilities.includes('renderSettings')) {
    return { kind: 'predatesFeature' };
  }

  if (!screenshot.shareRenderSettings) {
    return { kind: 'notShared', isViewerCreator: screenshot.creator.id == viewerCreatorId };
  }

  const groups = groupPhotoModeSettings(screenshot.renderSettings, photoModeCatalog);

  return groups.length > 0 ? { kind: 'content', groups } : { kind: 'sharedEmpty' };
}

/**
 * Lists the stored settings under their tab and section, in the catalog's order, a color's or a
 * vector's components reassembled into one setting, and the codes the catalog lacks in a last
 * group.
 * The values reach the UI as text, though uploaded as numbers.
 */
function groupPhotoModeSettings(
  renderSettings: Readonly<Record<string, string>>,
  catalog: readonly PhotoModeProperty[]
): readonly PhotoModeGroup[] {
  // By setting code, each at the place of its first component in the catalog, which a later
  // component's `set` keeps.
  const listed = new Map<string, { property: PhotoModeProperty; value: PhotoModeValue }>();

  for (const property of catalog) {
    const text = renderSettings[property.code];

    if (text == undefined) {
      continue;
    }

    const [code, component] = splitComponent(property.code);

    listed.set(code, {
      property,
      value: readValue(property, component, Number(text), listed.get(code)?.value)
    });
  }

  // Groups and sections in order of first appearance, which is the catalog's.
  const sectionsByGroup = new Map<string, Map<string | undefined, UnnotedSetting[]>>();

  for (const [code, { property, value }] of listed) {
    let sections = sectionsByGroup.get(property.group);

    if (!sections) {
      sections = new Map();
      sectionsByGroup.set(property.group, sections);
    }

    const sectionId = property.section ?? undefined;

    let settings = sections.get(sectionId);

    if (!settings) {
      settings = [];
      sections.set(sectionId, settings);
    }

    settings.push({ code, value });
  }

  const groups = [...sectionsByGroup].map(([id, sections]): PhotoModeGroup => ({
    id,
    sections: [...sections].map(([sectionId, settings]) => ({
      id: sectionId,
      settings: withNotes(settings)
    }))
  }));

  const catalogCodes = new Set(catalog.map(property => property.code));

  const otherSettings = Object.entries(renderSettings)
    .filter(([code]) => !catalogCodes.has(code))
    .map(([code, text]): UnnotedSetting => ({
      code,
      value: { kind: 'number', value: Number(text), fractionDigits: undefined }
    }));

  return otherSettings.length > 0
    ? [
        ...groups,
        { id: undefined, sections: [{ id: undefined, settings: withNotes(otherSettings) }] }
      ]
    : groups;
}

type UnnotedSetting = Omit<PhotoModeSetting, 'noteId'>;

/**
 * A section's settings with the mod's notes, one note for a run of settings sharing it
 * (Temperature and Tint), under the last of the run.
 */
function withNotes(settings: readonly UnnotedSetting[]): readonly PhotoModeSetting[] {
  return settings.map((setting, index) => {
    const noteId = photoModeNotes.get(setting.code);

    const isRunContinued = noteId == photoModeNotes.get(settings[index + 1]?.code ?? '');

    return { ...setting, noteId: isRunContinued ? undefined : noteId };
  });
}

/**
 * A setting's value in its display form, {@link previous} holding the components of the same color
 * or vector read so far.
 */
function readValue(
  property: PhotoModeProperty,
  component: string,
  value: number,
  previous: PhotoModeValue | undefined
): PhotoModeValue {
  switch (property.kind) {
    case 'number': {
      return {
        kind: 'number',
        // The game carries an hour past midnight over to the following days, whose sun at that
        // hour barely differs, so a stored value past 24 reads as that hour.
        value: property.code == TIME_OF_DAY_CODE ? value % HOURS_PER_DAY : value,
        fractionDigits: property.fractionDigits
      };
    }
    case 'enum': {
      // The game rounds the stored number to the nearest integer to pick the option.
      const rounded = Math.round(value);

      return {
        kind: 'enum',
        enumType: property.enumType ?? '',
        option: property.enumOptions.find(option => option.value == rounded)?.name,
        value: rounded
      };
    }
    case 'checkbox': {
      return { kind: 'checkbox', isOn: Math.round(value) != 0 };
    }
    case 'colorComponent': {
      // A channel not stored reads as the game's own fallback: black.
      const color =
        previous?.kind == 'color'
          ? previous
          : { kind: 'color' as const, red: 0, green: 0, blue: 0, alpha: undefined };

      const channel = colorChannels.get(component);

      return channel ? { ...color, [channel]: value } : color;
    }
    case 'vectorComponent': {
      const components = previous?.kind == 'vector' ? previous.components : [];

      return {
        kind: 'vector',
        components: [...components, { name: component, value }],
        fractionDigits: property.fractionDigits
      };
    }
    default: {
      // oxlint-disable-next-line typescript/only-throw-error
      throw property.kind satisfies never;
    }
  }
}

/**
 * The hue in sixths of a turn, the game picker's own formula.
 */
function hueSixths(
  { red, green, blue }: Extract<PhotoModeValue, { kind: 'color' }>,
  max: number,
  chroma: number
): number {
  if (chroma == 0) {
    return 0;
  }

  if (max == red) {
    return (green - blue) / chroma + (green < blue ? SIXTHS_PER_TURN : 0);
  }

  if (max == green) {
    return (blue - red) / chroma + GREEN_HUE_SIXTHS;
  }

  return (red - green) / chroma + BLUE_HUE_SIXTHS;
}

const SIXTHS_PER_TURN = 6;

const GREEN_HUE_SIXTHS = 2;

const BLUE_HUE_SIXTHS = 4;

const DEGREES_PER_TURN = 360;

const DEGREES_PER_SIXTH = DEGREES_PER_TURN / SIXTHS_PER_TURN;

const PERCENT = 100;

/**
 * A component property's code split into the setting's code and the component's suffix, the
 * suffix empty for a property of a single value.
 */
function splitComponent(code: string): readonly [code: string, component: string] {
  const [setting = code, component = ''] = code.split('/');

  return [setting, component];
}

const TIME_OF_DAY_CODE = 'Time of Day';

const HOURS_PER_DAY = 24;

/**
 * The mod's notes on the settings whose effect depends on the scene's light, by setting code.
 */
const photoModeNotes: ReadonlyMap<string, string> = new Map([
  [
    'ColorAdjustments.postExposure',
    'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Post Exposure Note]'
  ],
  [
    'WhiteBalance.temperature',
    'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[White Balance Note]'
  ],
  [
    'WhiteBalance.tint',
    'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[White Balance Note]'
  ],
  [TIME_OF_DAY_CODE, 'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Time Of Day Note]']
]);

const colorChannels: ReadonlyMap<string, 'red' | 'green' | 'blue' | 'alpha'> = new Map([
  ['r', 'red'],
  ['g', 'green'],
  ['b', 'blue'],
  ['a', 'alpha']
]);

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
