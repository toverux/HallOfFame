import { Tooltip } from 'cs2/ui';
import { ReactElement, useEffect, useRef } from 'react';
import styles from './take-hof-picture-button.module.scss';

/**
 * Component that displays the HoF Take Picture button in the photo mode panel.
 * Takes the Vanilla Take Picture button HTML as a template and modifies it to
 * our needs. We mainly needed to create a dedicated component and the whole
 * portal thing for this button instead of just a few DOM patches in order to be
 * able to use our own defined <Tooltip> on it. About that, it's also that just
 * cloning the Vanilla button node was working very well, except for the tooltip
 * that was the one from the Vanilla button, and displayed in the wrong place,
 * with no way to change the text either.
 */
export function TakeHofPictureButton({ html }: { html: string }): ReactElement {
    // An neutral element just needed to put the HTML of the button somewhere.
    const spanRef = useRef<HTMLElement>(null);

    // This runs once when the DOM is loaded, with the spanRef element having
    // the template HTML of the Take Picture button. We modify it according to
    // our needs.
    useEffect(() => {
        // Retrieve button element, and add our custom class to it.
        const button = spanRef.current!.firstElementChild!;
        button.classList.add(styles.screenshotButton);

        // Adds the side label to the button, the original button has no text.
        const text = document.createElement('span');
        text.innerHTML = 'HoF';

        button.appendChild(text);
    }, [spanRef]);

    function onClick() {
        console.log('Take HoF picture!');
    }

    return (
        <Tooltip tooltip="Take your city to the Hall of Fame!">
            <span onClick={onClick} ref={spanRef} dangerouslySetInnerHTML={{ __html: html }}/>
        </Tooltip>);
}
