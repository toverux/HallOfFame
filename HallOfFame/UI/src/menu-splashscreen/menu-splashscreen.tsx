/**
 * Component that displays the splashscreen image on the main menu.
 */

import { useState } from 'react';
import styles from './menu-splashscreen.module.scss';

// This is the Vanilla image when the mod was written.
// It could be retrieved dynamically from calculated styles before we apply our
// override class, but it's unlikely to change. (right?)
const defaultSplashSrc = 'Media/Menu/Background2.jpg';

export function MenuSplashscreen() {
    // How this works: when a new image is requested (incomingImage), we load it
    // into browser cache memory. When it's ready (onLoad), we create a div with
    // the new image, and perform a fade-in over the previous image (currentImage).
    // When the fade-in animation is done, we set the new image as the current one.
    // This destroys the previous image div, freeing up memory. And the cycle repeats.

    const [currentImage, setCurrentImage] = useState(defaultSplashSrc);
    const [incomingImage, setIncomingImage] = useState<string | null>(null);

    // When a new image is requested, we load it into browser cache memory.
    // And when it's loaded, only then we set it as the incoming image, that
    // will start the fade-in animation.
    function loadNewImage(uri: string): void {
        const splash = new Image();
        splash.onload = () => setIncomingImage(uri);
        splash.src = uri;
    }

    // When the fade-in animation is done, we set the incoming image as the
    // current one.
    function handleIncomingImageAnimationEnd(): void {
        setCurrentImage(incomingImage!);
        setIncomingImage(null);
    }

    (window as any).loadNewImage = loadNewImage;

    // Note: We'll use <div> and not <img> to display background images, because
    // cohtml's engine does not support `object-fit: cover`.
    // noinspection HtmlRequiredAltAttribute
    return <>
        {currentImage &&
            <div
                // With [key], we actually recycle the main currentImage element,
                // that is, the div for incomingImage below will "become" this div.
                // This is a perf optimization to avoid creating two times a div
                // with the same image (state != dom).
                key={currentImage}
                className={styles.splashscreen}
                style={{ backgroundImage: `url(${currentImage})` }}/>
        }
        {incomingImage &&
            <div
                key={incomingImage}
                className={`${styles.splashscreen} ${styles.splashscreenFadeIn}`}
                style={{ backgroundImage: `url(${incomingImage})` }}
                onAnimationEnd={handleIncomingImageAnimationEnd}/>
        }
    </>;
}
