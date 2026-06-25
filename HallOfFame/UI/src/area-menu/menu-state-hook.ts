import { bindValue, useValue } from 'cs2/api';
import type { LocalizedString } from 'cs2/l10n';
import type { Dispatch, SetStateAction } from 'react';
import type { Screenshot } from '../common';
import { createSingletonHook, type ModSettings, useModSettings } from '../utils';

interface ReadonlyMenuState {
  readonly isSlideshowEnabled: boolean;

  /**
   * Current image to display, depending on quality setting, {@link screenshot.imageUrlFHD} or
   * {@link screenshot.imageUrl4K}.
   */
  readonly imageUri: string | null;

  /**
   * Whether a previous screenshot is available to display.
   *
   * @default false
   */
  readonly hasPreviousScreenshot: boolean;

  /**
   * Index of the current refresh cycle. Used to force the UI to request a new screenshot.
   *
   * @default 0
   */
  readonly forcedRefreshIndex: number;

  /**
   * Whether a new screenshot is being loaded, and/or a screenshot image is being preloaded.
   *
   * @default false
   */
  readonly isRefreshing: boolean;

  /**
   * Current screenshot data, or `null` when no data is available yet.
   */
  readonly screenshot: Screenshot | null;

  /**
   * Error that occurred while loading the screenshot, API request or image preloading included.
   */
  readonly error: LocalizedString | null;

  /**
   * Whether a save-image-to-disk operation is going on.
   */
  readonly isSaving: boolean;
}

interface SettableMenuState {
  /**
   * Whether the main game menu is visible or hidden by the user.
   *
   * @default true
   */
  readonly isMenuVisible: boolean;

  /**
   * Whether the UI is ready to display a new image, that includes:
   * - The current image has been fully loaded.
   * - The next image has been fully preloaded.
   * - The current image has finished its fade-in animation (so there are no "jumps" in the
   *   animation, and there is no need for the user to be able to hit Next every .5 seconds).
   */
  readonly isReadyForNextImage: boolean;
}

const enableMainMenuSlideshow$ = bindValue<boolean>(
  'hallOfFame.presenter',
  'enableMainMenuSlideshow',
  true
);

const hasPreviousScreenshot$ = bindValue<boolean>(
  'hallOfFame.presenter',
  'hasPreviousScreenshot',
  false
);

const forcedRefreshIndex$ = bindValue<number>('hallOfFame.presenter', 'forcedRefreshIndex', 0);

const isRefreshing$ = bindValue<boolean>('hallOfFame.presenter', 'isRefreshing', false);

const screenshot$ = bindValue<Screenshot | null>('hallOfFame.presenter', 'screenshot', null);

const error$ = bindValue<LocalizedString | null>('hallOfFame.presenter', 'error', null);

const isSaving$ = bindValue<boolean>('hallOfFame.presenter', 'isSaving', false);

const useSingletonMenuState = createSingletonHook<SettableMenuState>({
  isMenuVisible: true,
  isReadyForNextImage: true
});

export function useHofMenuState(): [
  ReadonlyMenuState & SettableMenuState,
  Dispatch<SetStateAction<SettableMenuState>>
] {
  const settings = useModSettings();
  const [settableMenuState, setMenuState] = useSingletonMenuState();

  const enableMainMenuSlideshow = useValue(enableMainMenuSlideshow$);
  const hasPreviousScreenshot = useValue(hasPreviousScreenshot$);
  const isRefreshing = useValue(isRefreshing$);
  const forcedRefreshIndex = useValue(forcedRefreshIndex$);
  const screenshot = useValue(screenshot$);
  const error = useValue(error$);
  const isSaving = useValue(isSaving$);

  const menuState: ReadonlyMenuState & SettableMenuState = {
    ...settableMenuState,
    isSlideshowEnabled: enableMainMenuSlideshow,
    hasPreviousScreenshot,
    forcedRefreshIndex,
    isRefreshing,
    imageUri: deriveImageUri(screenshot, settings),
    screenshot,
    error,
    isSaving
  };

  return [menuState, setMenuState];
}

/**
 * Lightweight selector that only subscribes to the slideshow-enabled flag.
 *
 * Prefer this over {@link useHofMenuState} in components that only need to know whether the HoF
 * slideshow is active: the full hook subscribes to every presenter binding and would re-render
 * those components on unrelated updates.
 */
export function useIsSlideshowEnabled(): boolean {
  return useValue(enableMainMenuSlideshow$);
}

/**
 * Lightweight selector that only subscribes to the menu-visibility flag.
 *
 * @see useIsSlideshowEnabled for the rationale.
 */
export function useIsMenuVisible(): boolean {
  const [{ isMenuVisible }] = useSingletonMenuState();

  return isMenuVisible;
}

/**
 * Lightweight selector for the splashscreen, subscribing only to the current image URI and the
 * refreshing flag (plus the stable setter to report readiness for the next image), rather than
 * every presenter binding.
 *
 * @see useIsSlideshowEnabled for the rationale.
 */
export function useSplashscreenState(): readonly [
  Readonly<{ imageUri: string | null; isRefreshing: boolean }>,
  Dispatch<SetStateAction<SettableMenuState>>
] {
  const settings = useModSettings();
  const [, setMenuState] = useSingletonMenuState();

  const isRefreshing = useValue(isRefreshing$);
  const screenshot = useValue(screenshot$);

  return [{ imageUri: deriveImageUri(screenshot, settings), isRefreshing }, setMenuState];
}

/**
 * Resolves the image URI to display from the current screenshot, picking the resolution variant
 * that matches the user's quality setting.
 */
function deriveImageUri(screenshot: Screenshot | null, settings: ModSettings): string | null {
  if (!screenshot) {
    return null;
  }

  return settings.screenshotResolution == 'fhd' ? screenshot.imageUrlFHD : screenshot.imageUrl4K;
}
