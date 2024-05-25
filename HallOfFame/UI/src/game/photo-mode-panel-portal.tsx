import { getModule } from 'cs2/modding';
import { type ReactElement, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { logError } from '../common';
import { TakeHofPictureButton } from './take-hof-picture-button';

interface Props {
    readonly children: ReactElement;
}

/**
 * This component wraps the photo mode panel, but does not directly change how
 * it renders it in any way. Instead, it borrows its lifecycle to then create a
 * React Portal that will be inserted next to the Take Photo button.
 */
export function PhotoModePanelPortal({ children }: Props): ReactElement {
    const [hofButton, setHofButton] = useState<{
        target: Element;
        htmlTemplate: string;
    }>();

    // This is executed once each time the photo mode panel is displayed.
    // This patches the DOM and inserts a React Portal rendering our button next
    // to the Vanilla Take Photo button.
    useEffect(() => {
        // Get panel CSS classes
        const coPanelStyles: Record<string, string> = getModule(
            'game-ui/game/components/photo-mode/photo-mode-panel.module.scss',
            'classes'
        );

        // Find the Take Photo button, it's located in the panel and has a style
        // attribute containing "TakePicture". This seems to be a good way to
        // locate it in a reliable way as it does not have any other special
        // class or ID.
        const takePhotoSelector = `.${coPanelStyles.buttonPanel} > button > [style*=TakePicture]`;
        const takePictureButton =
            document.querySelector(takePhotoSelector)?.parentNode;

        if (!(takePictureButton instanceof Element)) {
            return logError(
                `HoF: Could not locate Take Photo button (using selector "${takePhotoSelector}")`
            );
        }

        // Insert a span element before the Take Photo button, it will be our
        // React Portal target. We use span because it's a relatively neutral
        // element.
        const span = document.createElement('span');
        takePictureButton.insertAdjacentElement('beforebegin', span);

        // This will render the portal!
        // We pass the Vanilla Take Photo button as a template for our own button.
        setHofButton({
            target: span,
            htmlTemplate: takePictureButton.outerHTML
        });
    }, []);

    return (
        <>
            {hofButton &&
                createPortal(
                    <TakeHofPictureButton html={hofButton.htmlTemplate} />,
                    hofButton.target
                )}
            {children}
        </>
    );
}
