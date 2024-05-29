import { bindValue, trigger, useValue } from 'cs2/api';
import { useLocalization } from 'cs2/l10n';
import { getModule } from 'cs2/modding';
import { Button, Icon } from 'cs2/ui';
import { type CSSProperties, type ReactElement, useMemo } from 'react';
import { logError } from '../common';
import cloudArrowUpSolidSrc from '../icons/cloud-arrow-up-solid.svg';
import styles from './screenshot-upload-panel.module.scss';

type ScreenshottingState =
    | { name: 'idle' }
    | { name: 'taking' }
    | {
          name: 'ready';
          uri: string;
          fileSize: number;
          width: number;
          height: number;
      }
    | { name: 'uploading' }
    | { name: 'uploaded' };

const coFixedRatioImageStyles: Record<string, string> = getModule(
    'game-ui/common/image/fixed-ratio-image.module.scss',
    'classes'
);

const coMainScreenStyles: Record<string, string> = getModule(
    'game-ui/game/components/game-main-screen.module.scss',
    'classes'
);

const screenshottingState$ = bindValue<ScreenshottingState>(
    'hallOfFame.game',
    'screenshottingState',
    { name: 'idle' }
);

/**
 * Component that shows up when the user takes a HoF screenshot.
 */
export function ScreenshotUploadPanel(): ReactElement {
    const { translate } = useLocalization();
    const state = useValue(screenshottingState$);

    // Change the congratulation message every time a screenshot is taken.
    // Congratulation messages are stored in one string, separated by newlines.
    // useMemo() with state.uri is used to change the message when the state
    // type and image URI actually change.
    // biome-ignore lint/correctness/useExhaustiveDependencies: explained above.
    const congratulation = useMemo(() => {
        if (state.name != 'ready') {
            return;
        }

        // biome-ignore lint/style/noNonNullAssertion: we have fallback.
        const congratulations = translate(
            'HallOfFame.UI.Game.ScreenshotUploadPanel.CONGRATULATIONS',
            'Nice shot!'
        )!
            // Each message is separated by a newline.
            .split('\n')
            .filter(translation => !translation.startsWith('//'));

        return congratulations[
            Math.floor(Math.random() * congratulations.length)
        ];
    }, [translate, state.name == 'ready' ? state.uri : 'no-congrats']);

    // Check vanilla class exists.
    if (!coMainScreenStyles.centerPanelLayout) {
        logError(
            new Error('HoF: Could not get a hold on .center-panel-layout class')
        );

        return <></>;
    }

    // Show panel when there is a screenshot to upload.
    if (!['ready', 'uploading', 'uploaded'].includes(state.name)) {
        return <></>;
    }

    return (
        <div
            className={`${coMainScreenStyles.centerPanelLayout} ${styles.screenshotUploadPanelLayout}`}>
            <div className={styles.screenshotUploadPanel}>
                <div className={styles.screenshotUploadPanelHeader}>
                    {congratulation}
                </div>

                {state.name == 'ready' && (
                    <div
                        className={coFixedRatioImageStyles.fixedRatioImage}
                        style={
                            {
                                '--w': state.width,
                                '--h': state.height
                            } as CSSProperties
                        }>
                        <div className={coFixedRatioImageStyles.ratio} />
                        <img
                            className={`${styles.screenshotUploadPanelImage} ${coFixedRatioImageStyles.image}`}
                            src={state.uri}
                            alt='Screenshot'
                        />
                    </div>
                )}

                <div className={styles.screenshotUploadPanelContent} />

                <div className={styles.screenshotUploadPanelFooter}>
                    <Button
                        className={`${styles.screenshotUploadPanelFooterButton} ${styles.cancel}`}
                        variant='primary'
                        onSelect={() =>
                            trigger('hallOfFame.game', 'clearScreenshot')
                        }
                        selectSound={'close-menu'}>
                        {translate('Common.ACTION[Cancel]', 'Cancel')}
                    </Button>

                    <Button
                        variant='primary'
                        className={styles.screenshotUploadPanelFooterButton}>
                        <Icon
                            src={cloudArrowUpSolidSrc}
                            tinted={true}
                            className={
                                styles.screenshotUploadPanelFooterButtonIcon
                            }
                        />
                        {translate(
                            'HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD',
                            'Upload'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
