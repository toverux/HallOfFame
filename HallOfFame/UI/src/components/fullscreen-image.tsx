import { ActiveControlSchemeInputHint, type InputActions, InputActionConsumer } from 'cs2/input';
import { Button, Icon } from 'cs2/ui';
import { type ReactElement, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useImageLoaded } from '../utils/use-image-loaded';
import * as styles from './fullscreen-image.module.scss';

/**
 * Shows an image whole over the entire screen, above every piece of the game's UI, with a close
 * button naming the key that closes it, so the way out is visible.
 * It opens on `placeholderSrc`, an image already decoded at the same framing, and lays `src` over
 * it once loaded, so a large image comes into focus rather than popping in over a black screen.
 * It closes on that button, on Back, and on a click anywhere.
 */
export function FullscreenImage({
  src,
  placeholderSrc,
  onClose
}: Readonly<{ src: string; placeholderSrc: string; onClose: () => void }>): ReactElement {
  const actions = useMemo((): InputActions => ({ Back: onClose }), [onClose]);

  const isLoaded = useImageLoaded(src);

  return createPortal(
    // Photo mode keeps its focus outside the path Back travels along, so a consumer waiting for
    // focus would never hear it: this one listens whatever holds the focus.
    <InputActionConsumer actions={actions} ignoreFocusState={true}>
      <div className={styles.fullscreenImage} onClick={onClose}>
        <div
          className={styles.fullscreenImageLayer}
          style={{ backgroundImage: `url(${placeholderSrc})` }}
        />

        <div
          className={styles.fullscreenImageLayer}
          style={{ backgroundImage: `url(${src})`, opacity: isLoaded ? 1 : 0 }}
        />

        <Button
          variant='flat'
          className={styles.fullscreenImageClose}
          selectSound='close-menu'
          // The click reaching the image already closes it.
          onClick={stopPropagation}
          onSelect={onClose}>
          <Icon
            src='Media/Glyphs/Close.svg'
            tinted={true}
            className={styles.fullscreenImageCloseIcon}
          />

          <ActiveControlSchemeInputHint
            action='Back'
            // The key's name alone, without the frame the game draws around a key: the button
            // already frames it.
            theme={keyTheme}
          />
        </Button>
      </div>
    </InputActionConsumer>,
    document.body
  );
}

const keyTheme = { button: styles.fullscreenImageCloseKey };

function stopPropagation(event: { stopPropagation: () => void }): void {
  event.stopPropagation();
}
