import { trigger, useValue } from 'cs2/api';
import type { LocalizedString } from 'cs2/l10n';
import type { Dispatch, SetStateAction } from 'react';
import type { Screenshot } from '../../common';
import { createSingletonHook } from '../singleton-hook';
import { type ModSettings, useModSettings } from './common';
import { lazyBindValue } from './lazy-value-binding';

const GROUP = 'hallOfFame.slideshow';

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
   * Whether the slideshow can advance to another screenshot, i.e., no navigation is moving the
   * cursor, and no image is being preloaded.
   *
   * @default true
   */
  readonly canAdvance: boolean;

  /**
   * Current screenshot data, or `null` when no data is available yet.
   */
  readonly screenshot: Screenshot | null;

  /**
   * Error that occurred while loading a screenshot to display (the random fetch or its image
   * preloading) on next/previous. Like, report, and save failures are surfaced through a dialog,
   * not this binding.
   */
  readonly loadError: LocalizedString | null;

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

const enableMainMenuSlideshow$ = lazyBindValue<boolean>(GROUP, 'enableMainMenuSlideshow', true);

const previousNeighbor$ = lazyBindValue<Screenshot | null>(GROUP, 'previousNeighbor', null);

const nextNeighbor$ = lazyBindValue<Screenshot | null>(GROUP, 'nextNeighbor', null);

const isInMainMenu$ = lazyBindValue<boolean>(GROUP, 'isInMainMenu', true);

const forcedRefreshIndex$ = lazyBindValue<number>(GROUP, 'forcedRefreshIndex', 0);

const canAdvance$ = lazyBindValue<boolean>(GROUP, 'canAdvance', true);

const screenshot$ = lazyBindValue<Screenshot | null>(GROUP, 'screenshot', null);

const loadError$ = lazyBindValue<LocalizedString | null>(GROUP, 'loadError', null);

const isSaving$ = lazyBindValue<boolean>(GROUP, 'isSaving', false);

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

  const enableMainMenuSlideshow = useValue(enableMainMenuSlideshow$());
  const hasPreviousScreenshot = useValue(previousNeighbor$()) != null;
  const canAdvance = useValue(canAdvance$());
  const forcedRefreshIndex = useValue(forcedRefreshIndex$());
  const screenshot = useValue(screenshot$());
  const loadError = useValue(loadError$());
  const isSaving = useValue(isSaving$());

  const menuState: ReadonlyMenuState & SettableMenuState = {
    ...settableMenuState,
    isSlideshowEnabled: enableMainMenuSlideshow,
    hasPreviousScreenshot,
    forcedRefreshIndex,
    canAdvance,
    imageUri: deriveImageUri(screenshot, settings),
    screenshot,
    loadError,
    isSaving
  };

  return [menuState, setMenuState];
}

/**
 * Subscribes to the current slideshow screenshot, the entity backing the menu slideshow, and the
 * loading-screen background.
 */
export function useScreenshot(): Screenshot | null {
  return useValue(screenshot$());
}

/**
 * Lightweight selector that only subscribes to the slideshow-enabled flag.
 *
 * Prefer this over {@link useHofMenuState} in components that only need to know whether the HoF
 * slideshow is active: the full hook subscribes to every slideshow binding and would re-render
 * those components on unrelated updates.
 */
export function useIsSlideshowEnabled(): boolean {
  return useValue(enableMainMenuSlideshow$());
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
 * can-advance flag (plus the stable setter to report readiness for the next image), rather than
 * every slideshow binding.
 *
 * @see useIsSlideshowEnabled for the rationale.
 */
export function useSplashscreenState(): readonly [
  Readonly<{ imageUri: string | null; canAdvance: boolean }>,
  Dispatch<SetStateAction<SettableMenuState>>
] {
  const settings = useModSettings();
  const [, setMenuState] = useSingletonMenuState();

  const canAdvance = useValue(canAdvance$());
  const screenshot = useValue(screenshot$());

  return [{ imageUri: deriveImageUri(screenshot, settings), canAdvance }, setMenuState];
}

/**
 * @public
 * The current slideshow screenshot with its window neighbors (previous and look-ahead), plus
 * whether the game is on the main menu, which together drive the keep-alive image set.
 */
export interface KeepAliveScreenshotsState {
  readonly current: Screenshot | null;
  readonly prev: Screenshot | null;
  readonly next: Screenshot | null;
  readonly isInMainMenu: boolean;
}

/**
 * Imperatively subscribes to the keep-alive screenshot window (current, neighbors, and in-menu
 * flag), invoking [listener] once with the current values and again on every change.
 *
 * This is a non-React subscription because the keep-alive nodes live directly on `document.body`,
 * outside the component tree (see `installKeepAliveImages`).
 *
 * @return A disposer that ends all subscriptions.
 */
export function subscribeToKeepAliveScreenshots(
  listener: (state: KeepAliveScreenshotsState) => void
): () => void {
  const notify = (): void =>
    listener({
      current: screenshot$().value,
      prev: previousNeighbor$().value,
      next: nextNeighbor$().value,
      isInMainMenu: isInMainMenu$().value
    });

  const subscriptions = [
    screenshot$().subscribe(notify),
    previousNeighbor$().subscribe(notify),
    nextNeighbor$().subscribe(notify),
    isInMainMenu$().subscribe(notify)
  ];

  notify();

  return () => {
    for (const subscription of subscriptions) {
      subscription.dispose();
    }
  };
}

export function previousScreenshot(): void {
  trigger(GROUP, 'previousScreenshot');
}

export function nextScreenshot(): void {
  trigger(GROUP, 'nextScreenshot');
}

export function saveScreenshot(): void {
  trigger(GROUP, 'saveScreenshot');
}

export function reportScreenshot(): void {
  trigger(GROUP, 'reportScreenshot');
}

export function likeScreenshot(): void {
  trigger(GROUP, 'likeScreenshot');
}

/**
 * @public
 * Resolves the image URI to display from the current screenshot, picking the resolution variant
 * that matches the user's quality setting.
 *
 * The screenshot carries every resolution variant, and the UI selects one here rather than being
 * handed a pre-resolved URL: deriving live means a resolution-setting change updates the on-screen
 * image immediately, with no round-trip.
 */
export function deriveImageUri(
  screenshot: Screenshot | null,
  settings: ModSettings
): string | null {
  if (!screenshot) {
    return null;
  }

  switch (settings.screenshotResolution) {
    case 'fhd':
      return screenshot.imageUrlFHD;
    case '4k':
      return screenshot.imageUrl4K;
    default:
      throw settings.screenshotResolution satisfies never;
  }
}
