import type { Screenshot } from '../common';
import type { ModSettings } from '../utils/bindings';

/**
 * @public
 * A deferred preload call recorded by {@link createFakePreloader}: the requested URL plus the
 * resolve/reject handles a test settles on command.
 */
export interface FakePreloadCall {
  readonly url: string;
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

/**
 * @public
 * Controllable substitute for the `preloadImage` seam.
 */
export interface FakePreloader {
  readonly preload: (url: string) => Promise<void>;
  readonly calls: readonly FakePreloadCall[];
  readonly resolveLast: (url: string) => void;
  readonly rejectLast: (url: string, error?: unknown) => void;
}

/**
 * @public
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
      new Promise<void>((resolve, reject) => {
        calls.push({ url, resolve, reject });
      }),
    resolveLast: url => findLast(url).resolve(),
    rejectLast: (url, error) => findLast(url).reject(error ?? new Error(`preload failed: ${url}`))
  };
}

/**
 * @public
 * Builds a {@link ModSettings} with test-friendly defaults, overridable per field.
 */
export function makeSettings(overrides: Partial<ModSettings> = {}): ModSettings {
  return {
    creatorName: '',
    enableLoadingScreenBackground: true,
    showFeaturedAsset: true,
    showCreatorSocials: true,
    showViewCount: false,
    screenshotResolution: 'fhd',
    namesTranslationMode: 'translate',
    creatorsScreenshotSaveDirectory: '',
    baseUrl: '',
    ...overrides
  };
}

/**
 * @public
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
    shareRenderSettings: false,
    renderSettings: {},
    createdAt: '',
    createdAtFormatted: '',
    createdAtFormattedDistance: '',
    likesCount: 0,
    viewsCount: 0,
    uniqueViewsCount: 0,
    likingPercentage: 0,
    isLiked: false,
    creator: {
      id: 'creator',
      creatorName: null,
      creatorNameLocale: null,
      creatorNameLatinized: null,
      creatorNameTranslated: null,
      socials: []
    },
    ...overrides
  };
}
