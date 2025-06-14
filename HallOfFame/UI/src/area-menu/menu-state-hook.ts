import { bindValue, useValue } from 'cs2/api';
import type { LocalizedString } from 'cs2/l10n';
import type { Dispatch } from 'react';
import type { Screenshot } from '../common';
import { createSingletonHook, useModSettings } from '../utils';

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
   * Whether a new screenshot is being loaded and/or a screenshot image is being preloaded.
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
  Dispatch<SettableMenuState>
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
    imageUri: screenshot
      ? settings.screenshotResolution == 'fhd'
        ? screenshot.imageUrlFHD
        : screenshot.imageUrl4K
      : null,
    screenshot,
    error,
    isSaving
  };

  return [menuState, setMenuState];
}
