import { trigger } from 'cs2/api';
import { useLocalization } from 'cs2/l10n';
import { Tooltip } from 'cs2/ui';
import { type ReactElement, useEffect, useRef } from 'react';
import sharePictureSrc from '../icons/uil/standard/share-picture.svg';
import { logError } from '../utils';
import * as styles from './take-hof-picture-button.module.scss';

/**
 * Component that displays the HoF Take Photo button in the photo mode panel.
 * Takes the Vanilla Take Photo button HTML as a template and modifies it to
 * our needs. We mainly needed to create a dedicated component and the whole
 * portal thing for this button instead of just a few DOM patches in order to be
 * able to use our own defined <Tooltip> on it. About that, it's also that just
 * cloning the Vanilla button node was working very well, except for the tooltip
 * that was the one from the Vanilla button, and displayed in the wrong place,
 * with no way to change the text either.
 */
export function TakeHofPictureButton({ html }: { html: string }): ReactElement {
    const { translate } = useLocalization();

    // A neutral element just needed to put the HTML of the button somewhere.
    const spanRef = useRef<HTMLElement>(null);

    // This runs once when the DOM is loaded, with the spanRef element having
    // the template HTML of the Take Photo button. We modify it according to
    // our needs.
    useEffect(() => {
        // Retrieve button element, and add our custom class to it.
        const button = spanRef.current?.firstElementChild;
        if (!(button instanceof HTMLButtonElement)) {
            return logError(
                new Error(`Expected template HTML to be a <button>.`)
            );
        }

        button.classList.add(styles.screenshotButton);

        // Replace button icon with our share picture icon.
        if (button.firstElementChild instanceof HTMLElement) {
            button.firstElementChild.style.maskImage = sharePictureSrc;
        }

        // Adds the side label to the button, the original button has no text.
        const text = document.createElement('span');
        text.innerHTML = 'HoF';

        button.appendChild(text);
    }, []);

    return (
        <Tooltip
            tooltip={translate(
                'HallOfFame.UI.Game.TakeHofPictureButton.BUTTON_TOOLTIP',
                `Take a screenshot with Hall of Fame`
            )}>
            <span
                ref={spanRef}
                onClick={takePicture}
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </Tooltip>
    );
}

function takePicture(): void {
    trigger('hallOfFame.capture', 'takeScreenshot');
}
