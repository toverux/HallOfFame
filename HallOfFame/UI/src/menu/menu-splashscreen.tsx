import { type ReactElement, useEffect, useState } from 'react';
import * as styles from './menu-splashscreen.module.scss';
import { useHofMenuState } from './menu-state-hook';

/**
 * Component that displays the splashscreen image on the main menu.
 *
 * ###### Implementation notes
 * How this works: when a new image is requested (`menuState.imageUri`
 * changes and triggers `incomingImage` state update), we create a div with
 * the new image, and perform a fade-in over the previous image which is
 * set by `displayedImage` state variable.
 * When the fade-in animation is done, we set the new image as the current one,
 * and the main div becomes the bearer of the image.
 * This destroys the previous fade-in div, freeing up memory.
 * And the cycle repeats.
 */
export function MenuSplashscreen(): ReactElement {
    const [menuState, setMenuState] = useHofMenuState();

    // The current image displayed on the splashscreen.
    // Initialized with the image available at startup, so there is not fade-in
    // animation for the first image.
    const [displayedImage, setDisplayedImage] = useState(menuState.imageUri);

    const [incomingImage, setIncomingImage] = useState<string>();

    const [isAnimatingFadeIn, setIsAnimatingFadeIn] = useState(false);

    // When the menu is refreshing or the fade-in animation is in progress, we
    // disable the ability to show the next image.
    // biome-ignore lint/correctness/useExhaustiveDependencies: by design + avoid effect loop
    useEffect(() => {
        setMenuState({
            ...menuState,
            isReadyForNextImage: !(menuState.isRefreshing || isAnimatingFadeIn)
        });
    }, [menuState.isRefreshing, isAnimatingFadeIn]);

    // When a new image is requested, we set it as the incoming image, this will
    // trigger the fade-in animation and later.
    useEffect(() => {
        // Condition mostly to avoid fading of the default background... over
        // the default background.
        if (menuState.imageUri != displayedImage) {
            setIncomingImage(menuState.imageUri);
        }
    }, [displayedImage, menuState.imageUri]);

    // Note: We'll use <div> and not <img> to display background images, because
    // cohtml's engine does not support `object-fit: cover`.
    // noinspection HtmlRequiredAltAttribute
    return (
        <>
            {displayedImage && (
                <div
                    // With [key], we actually recycle the main displayedImage
                    // element, that is, the div for incomingImage below will
                    // "become" this div.
                    // This is a perf optimization to avoid creating two times a
                    // div with the same image (state != dom).
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

    // When the incoming image starts to fade-in, we mark the fade-in animation
    // as in progress.
    function handleIncomingImageAnimationStart(): void {
        setIsAnimatingFadeIn(true);
    }

    // When the fade-in animation is done, we set the incoming image as the
    // current one. We also mark the fade-in animation as done.
    function handleIncomingImageAnimationEnd(): void {
        // biome-ignore lint/style/noNonNullAssertion: it can't be null when the event occurs.
        setDisplayedImage(incomingImage!);
        setIncomingImage(undefined);
        setIsAnimatingFadeIn(false);
    }
}
