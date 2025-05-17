import { type ReactElement, useEffect, useState } from 'react';
import { getClassesModule, selector } from '../utils';
import * as styles from './menu-splashscreen.module.scss';
import { useHofMenuState } from './menu-state-hook';

const coMenuUiBackdropsStyles = getClassesModule(
  'game-ui/menu/components/menu-ui-backdrops/menu-ui-backdrops.module.scss',
  ['backdropImage']
);

/**
 * Component that displays the splashscreen image on the main menu.
 *
 * ###### Implementation notes
 * How this works: when a new image is requested (`menuState.imageUri` changes and triggers
 * `incomingImage` state update), we create a div with the new image and perform a fade-in over the
 * previous image which is set by `displayedImage` state variable.
 * When the fade-in animation is done, we set the new image as the current one, and the main div
 * becomes the bearer of the image.
 * This destroys the previous fade-in div, freeing up memory.
 * And the cycle repeats.
 */
export function MenuSplashscreen(): ReactElement {
  const [menuState, setMenuState] = useHofMenuState();

  // The current image displayed on the splashscreen.
  // Initialized at the start with the current Vanilla slideshow image, so there is a transparent
  // takeover of HoF on the Vanilla system.
  const [displayedImage, setDisplayedImage] = useState(
    menuState.imageUri ?? getCurrentSlideshowImageSrc()
  );

  const [incomingImage, setIncomingImage] = useState<string>();

  const [isAnimatingFadeIn, setIsAnimatingFadeIn] = useState(false);

  // When the menu is refreshing or the fade-in animation is in progress, we disable the ability to
  // show the next image.
  // biome-ignore lint/correctness/useExhaustiveDependencies: by design + avoid effect loop
  useEffect(() => {
    setMenuState({
      ...menuState,
      isReadyForNextImage: !(menuState.isRefreshing || isAnimatingFadeIn)
    });
  }, [menuState.isRefreshing, isAnimatingFadeIn]);

  // When a new image is requested, we set it as the incoming image; this will trigger the fade-in
  // animation.
  useEffect(() => {
    // Condition mostly to avoid fading of the default background... over the default background.
    if (menuState.imageUri && menuState.imageUri != displayedImage) {
      setIncomingImage(menuState.imageUri);
    }
  }, [displayedImage, menuState.imageUri]);

  // Note: We'll use <div> and not <img> to display background images, because cohtml's engine does
  // not support `object-fit: cover`.
  // noinspection HtmlRequiredAltAttribute
  return (
    <>
      {displayedImage && (
        <div
          // With [key], we actually recycle the main displayedImage element; that is, the div for
          // incomingImage below will "become" this div.
          // This is a perf optimization to avoid creating two times a div with the same image
          // (state != dom).
          key={displayedImage}
          className={styles.splashscreen}
          style={{ backgroundImage: `url(${displayedImage})` }}
        />
      )}
      {incomingImage && (
        <div
          key={incomingImage}
          className={`${styles.splashscreen} ${styles.splashscreenFadeIn}`}
          style={{ backgroundImage: `url(${incomingImage})` }}
          onAnimationStart={handleIncomingImageAnimationStart}
          onAnimationEnd={handleIncomingImageAnimationEnd}
        />
      )}
    </>
  );

  // When the incoming image starts to fade-in, we mark the fade-in animation as in progress.
  function handleIncomingImageAnimationStart(): void {
    setIsAnimatingFadeIn(true);
  }

  // When the fade-in animation is done, we set the incoming image as the current one.
  // We also mark the fade-in animation as done.
  function handleIncomingImageAnimationEnd(): void {
    // biome-ignore lint/style/noNonNullAssertion: it can't be null when the event occurs.
    setDisplayedImage(incomingImage!);
    setIncomingImage(undefined);
    setIsAnimatingFadeIn(false);
  }
}

/**
 * Called once when initializing the mod's menu UI, at this time the Vanilla backdrop image element
 * is still present (it is destroyed by our module override - see folder's index.tsx - but will only
 * disappear on the next render cycle).
 * So we retrieve the image currently shown by the Vanilla slideshow to ensure a smooth transition
 * between Vanilla and the mod backgrounds.
 */
function getCurrentSlideshowImageSrc(): string | null {
  const backdropImageEl = document.querySelector(selector(coMenuUiBackdropsStyles.backdropImage));

  // This should not happen in principle, but be safe and fail gracefully.
  if (!(backdropImageEl instanceof HTMLElement)) {
    return null;
  }

  // Here too, we shouldn't get a null result but again, fail gracefully.
  return (
    backdropImageEl.style.backgroundImage
      // biome-ignore lint/performance/useTopLevelRegex: called only once
      ?.match(/^url\(["']?(.*?)["']?\)$/)?.[1] || null
  );
}
