import { type ReactElement, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip } from '../components/tooltip';
import sharePictureSrc from '../icons/uil/share-picture.svg';
import { logError, useTranslate } from '../utils';
import * as bindings from '../utils/bindings';
import { useCaptureVeilPhase } from './capture-veil-phase';
import * as styles from './take-hof-picture-button.module.scss';

const VEIL_FADE_DURATION_MS = 250;

// The frames right after the capture are slow too, and a fade timed by the clock alone would end
// within one of them: each frame advances it by this much at most.
const VEIL_FADE_MAX_STEP_MS = 50;

/**
 * Component that displays the HoF Take Photo button in the photo mode panel.
 * Takes the Vanilla Take Photo button HTML as a template and modifies it to our needs.
 * We mainly needed to create a dedicated component and the whole portal thing for this button
 * instead of just a few DOM patches, to be able to use our own defined <Tooltip> on it.
 * About that, it's also that just cloning the Vanilla button node was working very well, except for
 * the tooltip that was the one from the Vanilla button, and displayed in the wrong place, with no
 * way to change the text either.
 *
 * A press covers the screen with a veil before it requests the capture, which freezes the game in
 * the frame it runs: the veil is then on screen through the freeze, and fades once it is over.
 */
export function TakeHofPictureButton({
  html,
  requestFrame = requestAnimationFrame
}: {
  readonly html: string;
  /**
   * Schedules a callback for the next frame, injectable so tests run the frames one by one.
   */
  readonly requestFrame?: (onFrame: () => void) => void;
}): ReactElement {
  const translate = useTranslate();

  const screenshotSnapshot = bindings.useScreenshotSnapshot();

  const [veilPhase, setVeilPhase] = useCaptureVeilPhase();

  const isVeilUp = veilPhase != 'hidden';

  // A neutral element just needed to put the HTML of the button somewhere.
  const spanRef = useRef<HTMLElement>(null);

  const veilRef = useRef<HTMLDivElement>(null);

  // This runs once when the DOM is loaded, with the spanRef element having the template HTML of the
  // Take Photo button. We modify it according to our needs.
  useEffect(() => {
    // Retrieve the button element and add our custom class to it.
    const button = spanRef.current?.firstElementChild;

    if (!(button instanceof HTMLButtonElement)) {
      return logError(new Error(`Expected template HTML to be a <button>.`));
    }

    button.classList.add(styles.button);

    // Replace the button icon with our share picture icon.
    if (button.firstElementChild instanceof HTMLElement) {
      button.firstElementChild.style.maskImage = `url(${sharePictureSrc})`;
    }

    // Adds the side label to the button, the original button has no text.
    const text = document.createElement('span');
    text.innerHTML = 'HoF';

    button.appendChild(text);
  }, []);

  // The veil leaves with the button, when photo mode closes, so the upload panel does not wait for
  // it.
  useEffect(() => () => setVeilPhase('hidden'), [setVeilPhase]);

  /**
   * Shows the veil and requests the capture, unless a capture still runs: the C# side ignores such
   * a press too, and stays the authority.
   */
  function takeHofPicture(): void {
    if (isVeilUp || (screenshotSnapshot && !screenshotSnapshot.isImageReady)) {
      return;
    }

    setVeilPhase('shown');

    // The veil renders in the frame after the press, and reaches the screen in the one after; the
    // fade starts once the capture's frame is over.
    requestFrame(() =>
      requestFrame(() => {
        // Triggered first, so the shutter starts before the freeze and plays through it.
        bindings.playSound('take-photo');
        bindings.takeScreenshot();

        requestFrame(fadeVeil);
      })
    );
  }

  /**
   * Fades the veil out frame by frame, setting its opacity directly rather than re-rendering.
   */
  function fadeVeil(): void {
    setVeilPhase('fading');

    let elapsedMs = 0;
    let lastFrameTime = performance.now();

    requestFrame(step);

    function step(): void {
      const now = performance.now();

      elapsedMs += Math.min(now - lastFrameTime, VEIL_FADE_MAX_STEP_MS);
      lastFrameTime = now;

      if (elapsedMs >= VEIL_FADE_DURATION_MS) {
        setVeilPhase('hidden');

        return;
      }

      // Eased out, so the flash drops fast and lingers faintly, as a camera flash does.
      const opacity = (1 - elapsedMs / VEIL_FADE_DURATION_MS) ** 2;

      veilRef.current?.style.setProperty('opacity', String(opacity));

      requestFrame(step);
    }
  }

  return (
    <>
      <Tooltip
        disabled={isVeilUp}
        className={isVeilUp ? styles.buttonTooltipHidden : undefined}
        tooltip={translate('HallOfFame.UI.Game.TakeHofPictureButton.BUTTON_TOOLTIP')}>
        <span ref={spanRef} onClick={takeHofPicture} dangerouslySetInnerHTML={{ __html: html }} />
      </Tooltip>

      {/* Outside the span, as a portal's events bubble up its React parents, not its DOM ones. */}
      {isVeilUp &&
        createPortal(
          <div ref={veilRef} className={styles.veil} data-veil-phase={veilPhase}>
            <div className={styles.veilLabel}>
              {translate('HallOfFame.UI.Game.TakeHofPictureButton.TAKING_SCREENSHOT')}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
