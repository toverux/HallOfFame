import classNames from 'classnames';
import type { Localization } from 'cs2/l10n';
import { Button, Icon } from 'cs2/ui';
import { memo, type ReactElement, useMemo } from 'react';
import { type DraggableProps, useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import * as styles from './panel-header.module.scss';
import * as shared from './shared.module.scss';

export const ScreenshotUploadPanelHeader = memo(
  ({
    screenshotSnapshot,
    draggable
  }: Readonly<{
    screenshotSnapshot: bindings.JsonScreenshotSnapshot;
    draggable: DraggableProps;
  }>): ReactElement => {
    const translate = useTranslate();

    // Change the congratulation message every time a screenshot is taken.
    // Congratulation messages are stored in one string, separated by newlines.
    // useMemo() with imageUri is used to change the message when the state type and image URI
    // actually change.
    const congratulation = useMemo(
      () => getCongratulation(translate),
      // oxlint-disable-next-line react-hooks/exhaustive-deps - imageUri is an intentional cache key
      [translate, screenshotSnapshot.imageUri]
    );

    return (
      <div className={classNames(styles.header, shared.panelSurface)} {...draggable}>
        {congratulation}

        <Button
          variant='round'
          className={styles.headerClose}
          onSelect={bindings.clearScreenshot}
          selectSound='close-menu'>
          <Icon src='Media/Glyphs/Close.svg' />
        </Button>
      </div>
    );
  }
);

/**
 * Gets a random congratulation message (displayed in the dialog header).
 */
function getCongratulation(translate: Localization['translate']): string {
  // oxlint-disable-next-line typescript/no-non-null-assertion - translation key resolve
  const congratulations = translate(
    'HallOfFame.UI.Game.ScreenshotUploadPanel.CONGRATULATIONS'
  )!.split('\n'); // A newline separates each message.

  // oxlint-disable-next-line typescript/no-non-null-assertion - random index is always in bounds
  return congratulations[Math.floor(Math.random() * congratulations.length)]!;
}
