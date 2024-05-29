import { type ReactElement, useEffect, useState } from 'react';
import * as styles from './menu-splashscreen.module.scss';

interface Props {
    readonly imageUri: string;
}

/**
 * Component that displays the splashscreen image on the main menu.
 */
export function MenuSplashscreen({ imageUri }: Props): ReactElement {
    // How this works: when a new image is requested (incomingImage), we load it
    // into browser cache memory. When it's ready (onLoad), we create a div with
    // the new image, and perform a fade-in over the previous image (currentImage).
    // When the fade-in animation is done, we set the new image as the current one.
    // This destroys the previous image div, freeing up memory. And the cycle repeats.

    const [currentImage, setCurrentImage] = useState(imageUri);
    const [incomingImage, setIncomingImage] = useState<string>();

    // When a new image is requested, we load it into browser cache memory.
    // And when it's loaded, only then we set it as the incoming image, that
    // will start the fade-in animation.
    useEffect(() => {
        const splash = new Image();
        splash.onload = () => setIncomingImage(imageUri);
        splash.src = imageUri;
    }, [imageUri]);

    // When the fade-in animation is done, we set the incoming image as the
    // current one.
    function handleIncomingImageAnimationEnd(): void {
        // biome-ignore lint/style/noNonNullAssertion: it can't be null when the event occurs.
        setCurrentImage(incomingImage!);
        setIncomingImage(undefined);
    }

    // Note: We'll use <div> and not <img> to display background images, because
    // cohtml's engine does not support `object-fit: cover`.
    // noinspection HtmlRequiredAltAttribute
    return (
        <>
            {currentImage && (
                <div
                    // With [key], we actually recycle the main currentImage element,
                    // that is, the div for incomingImage below will "become" this div.
                    // This is a perf optimization to avoid creating two times a div
                    // with the same image (state != dom).
                    key={currentImage}
                    className={styles.splashscreen}
                    style={{ backgroundImage: `url(${currentImage})` }}
                />
            )}
            {incomingImage && (
                <div
                    key={incomingImage}
                    className={`${styles.splashscreen} ${styles.splashscreenFadeIn}`}
                    style={{ backgroundImage: `url(${incomingImage})` }}
                    onAnimationEnd={handleIncomingImageAnimationEnd}
                />
            )}
        </>
    );
}
