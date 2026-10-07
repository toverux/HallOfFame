import type { Creator, Mod, PhotoModeProperty, Screenshot, SkyveVerdict } from '../common';
import type { JsonScreenshotSnapshot, ModSettings } from '../utils/bindings';

/**
 * A deferred preload call recorded by {@link createFakePreloader}: the requested URL plus the
 * resolve/reject handles a test settles on command.
 */
export interface FakePreloadCall {
  readonly url: string;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

/**
 * Controllable substitute for the `preloadImage` seam.
 */
export interface FakePreloader {
  readonly preload: (url: string) => Promise<void>;
  readonly calls: readonly FakePreloadCall[];
  readonly resolveLast: (url: string) => void;
  readonly rejectLast: (url: string, error?: unknown) => void;
}

/**
 * Substitute for the `preloadImage` seam that records every call and lets a test resolve or reject
 * a specific URL on command, so `onload`/`onerror`/timeout are deterministic, not wall-clock.
 */
export function createFakePreloader(): FakePreloader {
  const calls: FakePreloadCall[] = [];

  const findLast = (url: string): FakePreloadCall => {
    const call = calls.findLast(candidate => candidate.url == url);

    if (!call) {
      throw new Error(`No preload call recorded for "${url}".`);
    }

    return call;
  };

  return {
    calls,
    preload: url =>
      // oxlint-disable-next-line promise/avoid-new - deferred promise: captures resolve/reject to settle on command in tests
      new Promise<void>((resolve, reject) => {
        calls.push({ url, resolve, reject });
      }),
    resolveLast: url => findLast(url).resolve(),
    rejectLast: (url, error) => findLast(url).reject(error ?? new Error(`preload failed: ${url}`))
  };
}

/**
 * Builds a {@link ModSettings} with test-friendly defaults, overridable per field.
 */
export function makeSettings(overrides: Partial<ModSettings> = {}): ModSettings {
  return {
    creatorName: '',
    enableLoadingScreenBackground: true,
    showFeaturedAsset: true,
    showCreatorSocials: true,
    showCityInfo: true,
    showViewCount: false,
    showScreenshotDetails: true,
    screenshotResolution: 'fhd',
    namesTranslationMode: 'translate',
    creatorsScreenshotSaveDirectory: '',
    baseUrl: '',
    publicCreatorId: null,
    ...overrides
  };
}

/**
 * Builds a {@link Screenshot} with placeholder defaults, overridable per field.
 */
export function makeScreenshot(overrides: Partial<Screenshot> = {}): Screenshot {
  return {
    id: 'id',
    cityName: '',
    cityNameLocale: null,
    cityNameLatinized: null,
    cityNameTranslated: null,
    cityMilestone: 0,
    cityPopulation: 0,
    mapName: '',
    description: '',
    imageUrlFHD: 'fhd.png',
    imageUrl4K: '4k.png',
    viewerUrl: 'https://api.test/screenshots/id/viewer',
    viewerShareUrl: 'https://viewer.test/city/id',
    paradoxModIds: [],
    shareParadoxModIds: false,
    shareRenderSettings: false,
    renderSettings: {},
    renderConditions: {},
    capabilities: [],
    createdAt: '',
    createdAtFormatted: '',
    createdAtFormattedDistance: '',
    likesCount: 0,
    viewsCount: 0,
    uniqueViewsCount: 0,
    likingPercentage: 0,
    isLiked: false,
    creator: makeCreator(),
    ...overrides
  };
}

/**
 * Builds a {@link Creator} with placeholder defaults, overridable per field.
 * The default is anonymous, matching a creator who never set a name.
 */
export function makeCreator(overrides: Partial<Creator> = {}): Creator {
  return {
    id: 'creator',
    creatorName: null,
    creatorNameLocale: null,
    creatorNameLatinized: null,
    creatorNameTranslated: null,
    viewerUrl: 'https://api.test/creators/creator/viewer',
    viewerShareUrl: 'https://viewer.test/?creator=creator',
    socials: [],
    ...overrides
  };
}

/**
 * Builds a {@link JsonScreenshotSnapshot} with placeholder defaults, overridable per field, its
 * render settings the ones the upload panel raises no warning for.
 */
export function makeScreenshotSnapshot(
  overrides: Partial<JsonScreenshotSnapshot> = {}
): JsonScreenshotSnapshot {
  return {
    achievedMilestone: 0,
    population: 0,
    previewImageUri: '',
    imageUri: '',
    imageFileSize: 0,
    imageWidth: 0,
    imageHeight: 0,
    wasGlobalIlluminationDisabled: false,
    areSettingsTopQuality: true,
    ...overrides
  };
}

/**
 * Builds a {@link Mod} with placeholder defaults, its ID and name derived from its Paradox Mods ID.
 */
export function makeMod(overrides: Partial<Mod> & Pick<Mod, 'paradoxModId'>): Mod {
  const { paradoxModId } = overrides;

  return {
    id: `mod-${paradoxModId}`,
    name: `Mod ${paradoxModId}`,
    authorName: '',
    shortDescription: '',
    thumbnailUrl: '',
    subscribersCount: 0,
    tags: [],
    state: 'published',
    requiredGameVersion: null,
    sizeFormatted: null,
    knownLastReleasedAtFormattedDistance: null,
    knownLastReleasedAt: null,
    skyve: null,
    ...overrides
  };
}

/**
 * Builds a {@link SkyveVerdict} as the server sends it, stable and reviewed on the running game's
 * version, overridable per field.
 */
export function makeSkyveVerdict(overrides: Partial<SkyveVerdict> = {}): SkyveVerdict {
  return {
    stability: 'stable',
    note: null,
    reviewedAt: '2026-09-15T16:16:02.537Z',
    reviewedAtFormattedDistance: '22 days ago',
    reviewedGameVersion: '1.6.2f1',
    ...overrides
  };
}

/**
 * Builds a {@link PhotoModeProperty}, a number with the game's default fraction digits unless
 * overridden.
 */
function makePhotoModeProperty(
  overrides: Partial<PhotoModeProperty> & Pick<PhotoModeProperty, 'code' | 'group'>
): PhotoModeProperty {
  return {
    section: null,
    kind: 'number',
    fractionDigits: 3,
    enumType: null,
    enumOptions: [],
    ...overrides
  };
}

/**
 * A slice of the game's photo mode property catalog, in the game's order, covering every value
 * kind, sections, and a group without any.
 */
export const photoModeCatalog: readonly PhotoModeProperty[] = [
  makePhotoModeProperty({
    code: 'PhotoModeRenderSystem.sensorSize/x',
    group: 'Camera',
    section: 'CameraBody',
    kind: 'vectorComponent'
  }),
  makePhotoModeProperty({
    code: 'PhotoModeRenderSystem.sensorSize/y',
    group: 'Camera',
    section: 'CameraBody',
    kind: 'vectorComponent'
  }),
  makePhotoModeProperty({
    code: 'PhotoModeRenderSystem.iso',
    group: 'Camera',
    section: 'CameraBody',
    fractionDigits: 0
  }),
  makePhotoModeProperty({
    code: 'PhotoModeRenderSystem.gateFitMode',
    group: 'Camera',
    section: 'CameraBody',
    kind: 'enum',
    enumType: 'GateFitMode',
    enumOptions: [
      { name: 'None', value: 0 },
      { name: 'Vertical', value: 1 },
      { name: 'Horizontal', value: 2 }
    ]
  }),
  makePhotoModeProperty({
    code: 'PhotoModeRenderSystem.focalLength',
    group: 'Camera',
    section: 'CameraLens'
  }),
  makePhotoModeProperty({
    code: 'Vignette.color/r',
    group: 'Lens',
    section: 'Vignette',
    kind: 'colorComponent'
  }),
  makePhotoModeProperty({
    code: 'Vignette.color/g',
    group: 'Lens',
    section: 'Vignette',
    kind: 'colorComponent'
  }),
  makePhotoModeProperty({
    code: 'Vignette.color/b',
    group: 'Lens',
    section: 'Vignette',
    kind: 'colorComponent'
  }),
  makePhotoModeProperty({
    code: 'Vignette.rounded',
    group: 'Lens',
    section: 'Vignette',
    kind: 'checkbox'
  }),
  makePhotoModeProperty({
    code: 'ColorAdjustments.postExposure',
    group: 'Color',
    section: 'ColorAdjustments'
  }),
  makePhotoModeProperty({
    code: 'WhiteBalance.temperature',
    group: 'Color',
    section: 'WhiteBalance'
  }),
  makePhotoModeProperty({
    code: 'WhiteBalance.tint',
    group: 'Color',
    section: 'WhiteBalance'
  }),
  makePhotoModeProperty({
    code: 'Fog.albedo/r',
    group: 'Weather',
    section: 'Fog',
    kind: 'colorComponent'
  }),
  makePhotoModeProperty({
    code: 'Fog.albedo/g',
    group: 'Weather',
    section: 'Fog',
    kind: 'colorComponent'
  }),
  makePhotoModeProperty({
    code: 'Fog.albedo/b',
    group: 'Weather',
    section: 'Fog',
    kind: 'colorComponent'
  }),
  makePhotoModeProperty({
    code: 'Fog.albedo/a',
    group: 'Weather',
    section: 'Fog',
    kind: 'colorComponent'
  }),
  makePhotoModeProperty({ code: 'Time of Day', group: 'Environment' })
];
