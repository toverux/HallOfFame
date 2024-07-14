import { bindValue, trigger, useValue } from 'cs2/api';
import {
    type Localization,
    LocalizedNumber,
    LocalizedString,
    useLocalization
} from 'cs2/l10n';
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
import type { JsonSettings } from '../common';
import cloudArrowUpSolidSrc from '../icons/cloud-arrow-up-solid.svg';
import { getClassesModule } from '../utils';
import { DescriptionTooltip } from '../vanilla-modules/game-ui/common/tooltip/description-tooltip/description-tooltip';
import * as styles from './screenshot-upload-panel.module.scss';

interface JsonScreenshotSnapshot {
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

const settings$ = bindValue<JsonSettings>('hallOfFame', 'settings');

const cityName$ = bindValue<string>('hallOfFame.game', 'cityName');

const screenshotSnapshot$ = bindValue<JsonScreenshotSnapshot | null>(
    'hallOfFame.game',
    'screenshotSnapshot',
    null
);

/**
 * Component that shows up when the user takes a HoF screenshot.
 */
export function ScreenshotUploadPanel(): ReactElement {
    const { translate } = useLocalization();

    const settings = useValue(settings$);

    const creatorName =
        settings.creatorName ||
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
    const congratulation = useMemo(
        () => getCongratulation(translate, screenshotSnapshot),
        [translate, screenshotSnapshot?.imageUri]
    );

    const [isDragging, setIsDragging] = useState(false);

    // Maintains the state of the draggable panel.
    const draggableState = useRef({
        panelEl: undefined as HTMLElement | undefined,
        x: 0,
        y: 0
    });

    // Start dragging the panel when the user mouses down on the panel.
    const onMouseDown = useCallback((event: ReactMouseEvent) => {
        // Do not start dragging if the user clicked on a button.
        let maybeButton: EventTarget | null = event.target;
        while (maybeButton) {
            if (maybeButton instanceof HTMLButtonElement) {
                return;
            }

            maybeButton =
                maybeButton instanceof HTMLElement
                    ? maybeButton.parentElement
                    : null;
        }

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

    const ratioPreviewInfo = useMemo(
        () => screenshotSnapshot && getRatioPreviewInfo(screenshotSnapshot),
        [screenshotSnapshot]
    );

    // Show panel when there is a screenshot to upload.
    if (!(screenshotSnapshot && ratioPreviewInfo)) {
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
                    className={`${styles.screenshotUploadPanelImage} ${coFixedRatioImageStyles.fixedRatioImage}`}
                    style={
                        {
                            '--w': screenshotSnapshot.imageWidth,
                            '--h': screenshotSnapshot.imageHeight
                        } as CSSProperties
                    }>
                    {/* This div sets the size of its parent and therefore the size of the image. */}
                    <div className={coFixedRatioImageStyles.ratio} />

                    <img
                        className={coFixedRatioImageStyles.image}
                        src={screenshotSnapshot.imageUri}
                    />

                    {ratioPreviewInfo.type != 'equal' && (
                        <DescriptionTooltip
                            direction='down'
                            title={translate(
                                'HallOfFame.UI.Game.ScreenshotUploadPanel.ASPECT_RATIO_TOOLTIP_TITLE',
                                '16:9 Aspect Ratio Preview'
                            )}
                            description={translate(
                                'HallOfFame.UI.Game.ScreenshotUploadPanel.ASPECT_RATIO_TOOLTIP_DESCRIPTION',
                                'The border shows you how your image will be cropped on the most common aspect ratio.'
                            )}>
                            <div
                                className={
                                    styles.screenshotUploadPanelImageRatioPreview
                                }
                                style={ratioPreviewInfo.style}>
                                16:9
                            </div>
                        </DescriptionTooltip>
                    )}
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
                    <span
                        className={styles.screenshotUploadPanelFooterCreatorId}>
                        <LocalizedString
                            id='HallOfFame.UI.Game.ScreenshotUploadPanel.YOUR_CREATOR_ID'
                            fallback='Creator ID: {CREATOR_ID}'
                            // biome-ignore lint/style/useNamingConvention: i18n
                            args={{ CREATOR_ID: settings.creatorIdClue }}
                        />
                        &ndash;*
                    </span>

                    <div style={{ flex: 1 }} />

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

function getCongratulation(
    translate: Localization['translate'],
    screenshot: JsonScreenshotSnapshot | null
) {
    if (!screenshot) {
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

    return congratulations[Math.floor(Math.random() * congratulations.length)];
}

/**
 * Computes the type and style of the ratio preview overlay on the image,
 * helping the user to understand how the image will be cropped on the most
 * common aspect ratio, 16:9.
 */
function getRatioPreviewInfo(screenshot: JsonScreenshotSnapshot) {
    const mostCommonRatio = 16 / 9;

    const ratio = screenshot.imageWidth / screenshot.imageHeight;

    const type =
        ratio == mostCommonRatio
            ? 'equal'
            : ratio > mostCommonRatio
              ? 'narrower'
              : 'wider';

    const style = {
        width: type == 'wider' ? '100%' : `${(mostCommonRatio / ratio) * 100}%`,
        height: type == 'wider' ? `${(ratio / mostCommonRatio) * 100}%` : '100%'
    } satisfies CSSProperties;

    return { type, style } as const;
}

function discardScreenshot(): void {
    trigger('hallOfFame.game', 'clearScreenshot');
}
