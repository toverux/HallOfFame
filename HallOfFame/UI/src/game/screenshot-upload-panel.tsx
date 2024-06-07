import { bindValue, trigger, useValue } from 'cs2/api';
import { LocalizedNumber, LocalizedString, useLocalization } from 'cs2/l10n';
import { Button, Icon } from 'cs2/ui';
import {
    type CSSProperties,
    type ReactElement,
    type MouseEvent as ReactMouseEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';
import cloudArrowUpSolidSrc from '../icons/cloud-arrow-up-solid.svg';
import { getClassesModule } from '../utils';
import * as styles from './screenshot-upload-panel.module.scss';

interface ScreenshotSnapshot {
    readonly achievedMilestone: number;
    readonly population: number;
    readonly imageUri: string;
    readonly imageFileSize: number;
    readonly imageWidth: number;
    readonly imageHeight: number;
}

const coFixedRatioImageStyles = getClassesModule(
    'game-ui/common/image/fixed-ratio-image.module.scss',
    ['fixedRatioImage', 'image', 'ratio']
);

const coMainScreenStyles = getClassesModule(
    'game-ui/game/components/game-main-screen.module.scss',
    ['centerPanelLayout']
);

const creatorName$ = bindValue<string>('hallOfFame.game', 'creatorName', '');

const cityName$ = bindValue<string>('hallOfFame.game', 'cityName', '');

const screenshotSnapshot$ = bindValue<ScreenshotSnapshot | null>(
    'hallOfFame.game',
    'screenshotSnapshot',
    null
);

/**
 * Component that shows up when the user takes a HoF screenshot.
 */
export function ScreenshotUploadPanel(): ReactElement {
    const { translate } = useLocalization();

    const creatorName =
        useValue(creatorName$) ||
        // biome-ignore lint/style/noNonNullAssertion: we have fallback.
        translate('HallOfFame.Common.DEFAULT[CreatorName]', 'Anonymous')!;

    const cityName =
        useValue(cityName$) ||
        // biome-ignore lint/style/noNonNullAssertion: we have fallback.
        translate('HallOfFame.Common.DEFAULT[CityName]')!;

    const screenshotSnapshot = useValue(screenshotSnapshot$);

    // Change the congratulation message every time a screenshot is taken.
    // Congratulation messages are stored in one string, separated by newlines.
    // useMemo() with state.uri is used to change the message when the state
    // type and image URI actually change.
    // biome-ignore lint/correctness/useExhaustiveDependencies: explained above.
    const congratulation = useMemo(() => {
        if (!screenshotSnapshot) {
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
    }, [translate, screenshotSnapshot?.imageUri]);

    const [isDragging, setIsDragging] = useState(false);

    // Maintains the state of the draggable panel.
    const draggableState = useRef({
        panelEl: undefined as HTMLElement | undefined,
        x: 0,
        y: 0
    });

    // Start dragging the panel when the user mouses down on the panel.
    const onMouseDown = useCallback((event: ReactMouseEvent) => {
        const { current: state } = draggableState;

        // If the panel element changed, reset the offset to 0, 0.
        if (state.panelEl != event.currentTarget) {
            state.x = state.y = 0;
        }

        state.panelEl = event.currentTarget as HTMLElement;

        setIsDragging(true);
    }, []);

    // Move the panel when the user moves the mouse, just applying delta.
    const onMouseMove = useCallback((event: MouseEvent) => {
        const { current: state } = draggableState;
        if (!state.panelEl) {
            return;
        }

        state.x += event.movementX;
        state.y += event.movementY;

        // translate() would be more appropriate in theory, in a normal browser,
        // but here at low FPS I found left/top to work better.
        state.panelEl.style.left = `${state.x}px`;
        state.panelEl.style.top = `${state.y}px`;
    }, []);

    // Stop dragging when the user releases the mouse.
    const onMouseUp = useCallback(() => setIsDragging(false), []);

    // Add/remove event listeners when dragging.
    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        } else {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }, [isDragging, onMouseMove, onMouseUp]);

    // Show panel when there is a screenshot to upload.
    if (!screenshotSnapshot) {
        return <></>;
    }

    // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
    return (
        <div
            className={`${coMainScreenStyles.centerPanelLayout} ${styles.screenshotUploadPanelLayout}`}>
            <div
                className={styles.screenshotUploadPanel}
                onMouseDown={onMouseDown}>
                <div className={styles.screenshotUploadPanelHeader}>
                    {congratulation}

                    <Button
                        variant='round'
                        className={styles.screenshotUploadPanelHeaderClose}
                        onSelect={discardScreenshot}
                        selectSound={'close-menu'}>
                        <Icon src='Media/Glyphs/Close.svg' />
                    </Button>
                </div>

                <div
                    className={coFixedRatioImageStyles.fixedRatioImage}
                    style={
                        {
                            '--w': screenshotSnapshot.imageWidth,
                            '--h': screenshotSnapshot.imageHeight
                        } as CSSProperties
                    }>
                    <div className={coFixedRatioImageStyles.ratio} />
                    <img
                        className={`${styles.screenshotUploadPanelImage} ${coFixedRatioImageStyles.image}`}
                        src={screenshotSnapshot.imageUri}
                    />
                </div>

                <div
                    className={`${styles.screenshotUploadPanelContent} ${styles.screenshotUploadPanelCityInfo}`}>
                    <span className={styles.screenshotUploadPanelCityInfoName}>
                        <strong>{cityName}</strong>
                        <LocalizedString
                            id='HallOfFame.Common.CITY_BY'
                            fallback={'by {CREATOR_NAME}'}
                            // biome-ignore lint/style/useNamingConvention: i18n
                            args={{ CREATOR_NAME: creatorName }}
                        />
                    </span>
                    <div style={{ flex: 1 }} />
                    <span>
                        <img src='Media/Game/Icons/Trophy.svg' />
                        {translate(
                            `Progression.MILESTONE_NAME:${screenshotSnapshot.achievedMilestone}`
                        )}
                    </span>
                    <span>
                        <img src='Media/Game/Icons/Population.svg' />
                        <LocalizedNumber
                            value={screenshotSnapshot.population}
                        />
                    </span>
                </div>

                <div className={styles.screenshotUploadPanelContent}>
                    <p>
                        {translate(
                            'HallOfFame.UI.Game.ScreenshotUploadPanel.UPDATE_CITY_CREATOR_NAME_ON_THE_FLY',
                            `You can update your creator name or city name without closing this window.`
                        )}
                    </p>
                    <p>
                        {translate(
                            'HallOfFame.UI.Game.ScreenshotUploadPanel.MESSAGE_UPCOMING',
                            `Future update will let you manage your collection on our website.`
                        )}
                    </p>
                    <p style={{ margin: 0 }}>
                        {translate(
                            'HallOfFame.UI.Game.ScreenshotUploadPanel.MESSAGE_MODERATED',
                            `Uploaded content is moderated, any abuse will result in a permanent ban.`
                        )}
                    </p>
                </div>

                <div className={styles.screenshotUploadPanelFooter}>
                    <Button
                        className={`${styles.screenshotUploadPanelFooterButton} ${styles.cancel}`}
                        variant='primary'
                        onSelect={discardScreenshot}
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
                            'HallOfFame.UI.Game.ScreenshotUploadPanel.SHARE',
                            'Share'
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function discardScreenshot(): void {
    trigger('hallOfFame.game', 'clearScreenshot');
}
