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
    useEffect,
    useMemo
} from 'react';
import cloudArrowUpSolidSrc from '../icons/cloud-arrow-up-solid.svg';
import {
    type ModSettings,
    createSingletonHook,
    getClassesModule,
    useDraggable,
    useModSettings
} from '../utils';
import { DescriptionTooltip } from '../vanilla-modules/game-ui/common/tooltip/description-tooltip/description-tooltip';
import {
    LoadingProgress,
    loadingProgressVanillaProps
} from '../vanilla-modules/game-ui/overlay/logo-screen/loading/loading-progress';
import * as styles from './screenshot-upload-panel.module.scss';

interface JsonScreenshotSnapshot {
    readonly achievedMilestone: number;
    readonly population: number;
    readonly imageUri: string;
    readonly imageFileSize: number;
    readonly imageWidth: number;
    readonly imageHeight: number;
}

interface JsonUploadProgress {
    readonly isComplete: boolean;
    readonly globalProgress: number;
    readonly uploadProgress: number;
    readonly processingProgress: number;
}

const coFixedRatioImageStyles = getClassesModule(
    'game-ui/common/image/fixed-ratio-image.module.scss',
    ['fixedRatioImage', 'image', 'ratio']
);

const coLoadingStyles = getClassesModule(
    'game-ui/overlay/logo-screen/loading/loading.module.scss',
    ['hint', 'progress']
);

const coMainScreenStyles = getClassesModule(
    'game-ui/game/components/game-main-screen.module.scss',
    ['centerPanelLayout']
);

const cityName$ = bindValue<string>('hallOfFame.game', 'cityName');

const screenshotSnapshot$ = bindValue<JsonScreenshotSnapshot | null>(
    'hallOfFame.game',
    'screenshotSnapshot',
    null
);

const uploadProgress$ = bindValue<JsonUploadProgress | null>(
    'hallOfFame.game',
    'uploadProgress',
    null
);

/**
 * Component that shows up when the user takes a HoF screenshot.
 */
export function ScreenshotUploadPanel(): ReactElement {
    const { translate } = useLocalization();

    const settings = useModSettings();

    const draggable = useDraggable();

    const screenshotSnapshot = useValue(screenshotSnapshot$);
    const uploadProgress = useValue(uploadProgress$);

    // Show panel when there is a screenshot to upload.
    if (!screenshotSnapshot) {
        return <></>;
    }

    const creatorNameIsEmpty = !settings.creatorName.trim();

    return (
        <div
            className={`${coMainScreenStyles.centerPanelLayout} ${styles.screenshotUploadPanelLayout}`}>
            <div className={styles.screenshotUploadPanel} {...draggable}>
                <ScreenshotUploadPanelHeader
                    translate={translate}
                    screenshotSnapshot={screenshotSnapshot}
                />

                <ScreenshotUploadPanelImage
                    translate={translate}
                    screenshotSnapshot={screenshotSnapshot}
                    uploadProgress={uploadProgress}
                />

                <ScreenshotUploadPanelContentCityInfo
                    translate={translate}
                    settings={settings}
                    screenshotSnapshot={screenshotSnapshot}
                    creatorNameIsEmpty={creatorNameIsEmpty}
                />

                <ScreenshotUploadPanelContentOthers
                    translate={translate}
                    creatorNameIsEmpty={creatorNameIsEmpty}
                />

                <ScreenshotUploadPanelFooter
                    translate={translate}
                    settings={settings}
                    creatorNameIsEmpty={creatorNameIsEmpty}
                    uploadProgress={uploadProgress}
                />
            </div>
        </div>
    );
}

function ScreenshotUploadPanelHeader({
    translate,
    screenshotSnapshot
}: Readonly<{
    translate: Localization['translate'];
    screenshotSnapshot: JsonScreenshotSnapshot;
}>): ReactElement {
    // Change the congratulation message every time a screenshot is taken.
    // Congratulation messages are stored in one string, separated by newlines.
    // useMemo() with imageUri is used to change the message when the state
    // type and image URI actually change.
    // biome-ignore lint/correctness/useExhaustiveDependencies: explained above.
    const congratulation = useMemo(
        () => getCongratulation(translate),
        [translate, screenshotSnapshot.imageUri]
    );

    return (
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
    );
}

const useUploadSuccessImageUri = createSingletonHook<string | undefined>(
    undefined
);

function ScreenshotUploadPanelImage({
    translate,
    screenshotSnapshot,
    uploadProgress
}: Readonly<{
    translate: Localization['translate'];
    screenshotSnapshot: JsonScreenshotSnapshot;
    uploadProgress: JsonUploadProgress | null;
}>): ReactElement {
    const [successImageUri, setSuccessImageUri] = useUploadSuccessImageUri();

    const ratioPreviewInfo = useMemo(
        () => screenshotSnapshot && getRatioPreviewInfo(screenshotSnapshot),
        [screenshotSnapshot]
    );

    // This useEffect is used to display the success image after the upload is
    // complete, but only after some time so the progress circles have finished
    // animating.
    // biome-ignore lint/correctness/useExhaustiveDependencies: ignore setSuccessImageUri
    useEffect(() => {
        // Normal/in progress state, hide the success image.
        if (!uploadProgress?.isComplete) {
            setSuccessImageUri(undefined);
        }
        // Upload is complete and success image is not shown yet, display it
        // after the progress animation is done.
        else if (uploadProgress.isComplete && !successImageUri) {
            setTimeout(() => {
                setSuccessImageUri(getRandomUploadSuccessImage());
            }, 1500 /* This is roughly the takes it takes for the animation */);
        }
    }, [uploadProgress, successImageUri]);

    // noinspection HtmlRequiredAltAttribute
    return (
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
                        className={`${styles.screenshotUploadPanelImageRatioPreview} ${uploadProgress ? styles.screenshotUploadPanelImageRatioPreviewHide : ''}`}
                        style={ratioPreviewInfo.style}>
                        16:9
                    </div>
                </DescriptionTooltip>
            )}

            {uploadProgress && (
                <div
                    className={styles.screenshotUploadPanelImageUploadProgress}>
                    <div
                        className={`${styles.screenshotUploadPanelImageUploadProgressContent} ${successImageUri ? styles.screenshotUploadPanelImageUploadProgressContentUploadSuccess : ''}`}>
                        {successImageUri ? (
                            <img
                                src={successImageUri}
                                width={loadingProgressVanillaProps.size}
                                height={loadingProgressVanillaProps.size}
                                // This class which is applied to <LoadingProgress /> by
                                // the game can be reused as-is for the image.
                                className={coLoadingStyles.progress}
                            />
                        ) : (
                            <LoadingProgress
                                {...loadingProgressVanillaProps}
                                progress={[
                                    uploadProgress.globalProgress,
                                    uploadProgress.processingProgress,
                                    uploadProgress.uploadProgress
                                ]}
                            />
                        )}

                        <div className={coLoadingStyles.hint}>
                            {getUploadProgressHintText(
                                translate,
                                uploadProgress
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ScreenshotUploadPanelContentCityInfo({
    translate,
    settings,
    screenshotSnapshot,
    creatorNameIsEmpty
}: Readonly<{
    translate: Localization['translate'];
    settings: ModSettings;
    screenshotSnapshot: JsonScreenshotSnapshot;
    creatorNameIsEmpty: boolean;
}>): ReactElement {
    const cityName =
        useValue(cityName$) ||
        // biome-ignore lint/style/noNonNullAssertion: we have fallback.
        translate('HallOfFame.Common.DEFAULT_CITY_NAME')!;

    // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
    return (
        <div
            className={`${styles.screenshotUploadPanelContent} ${styles.screenshotUploadPanelCityInfo}`}>
            <span className={styles.screenshotUploadPanelCityInfoName}>
                <strong>{cityName}</strong>
                {!creatorNameIsEmpty && (
                    <LocalizedString
                        id='HallOfFame.Common.CITY_BY'
                        fallback={'by {CREATOR_NAME}'}
                        // biome-ignore lint/style/useNamingConvention: i18n convention
                        args={{ CREATOR_NAME: settings.creatorName }}
                    />
                )}
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
                <LocalizedNumber value={screenshotSnapshot.population} />
            </span>
        </div>
    );
}

function ScreenshotUploadPanelContentOthers({
    translate,
    creatorNameIsEmpty
}: Readonly<{
    translate: Localization['translate'];
    creatorNameIsEmpty: boolean;
}>): ReactElement {
    return (
        <>
            {creatorNameIsEmpty && (
                <div className={styles.screenshotUploadPanelWarning}>
                    {translate(
                        'HallOfFame.UI.Game.ScreenshotUploadPanel.CREATOR_NAME_IS_EMPTY',
                        `You must set your Creator Name in the mod settings to upload a picture.`
                    )}
                </div>
            )}

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
        </>
    );
}

function ScreenshotUploadPanelFooter({
    translate,
    settings,
    creatorNameIsEmpty,
    uploadProgress
}: Readonly<{
    translate: Localization['translate'];
    settings: ModSettings;
    creatorNameIsEmpty: boolean;
    uploadProgress: JsonUploadProgress | null;
}>): ReactElement {
    const isUploading = !!uploadProgress && !uploadProgress.isComplete;
    const isIdleOrUploading = !uploadProgress?.isComplete;
    const isDoneUploading = !!uploadProgress?.isComplete;

    return (
        <div className={styles.screenshotUploadPanelFooter}>
            <span className={styles.screenshotUploadPanelFooterCreatorId}>
                <LocalizedString
                    id='HallOfFame.UI.Game.ScreenshotUploadPanel.YOUR_CREATOR_ID'
                    fallback='Creator ID: {CREATOR_ID}'
                    // biome-ignore lint/style/useNamingConvention: i18n convention
                    args={{ CREATOR_ID: settings.creatorIdClue }}
                />
                &ndash;*
            </span>

            <div style={{ flex: 1 }} />

            {isIdleOrUploading && (
                <>
                    <Button
                        className={`${styles.screenshotUploadPanelFooterButton} ${styles.cancel}`}
                        variant='primary'
                        disabled={isUploading}
                        onSelect={discardScreenshot}
                        selectSound='close-menu'>
                        {translate('Common.ACTION[Cancel]', 'Cancel')}
                    </Button>

                    <Button
                        variant='primary'
                        className={styles.screenshotUploadPanelFooterButton}
                        disabled={creatorNameIsEmpty || isUploading}
                        onSelect={uploadScreenshot}>
                        <Icon
                            src={cloudArrowUpSolidSrc}
                            tinted={true}
                            className={
                                styles.screenshotUploadPanelFooterButtonIcon
                            }
                        />

                        {isUploading
                            ? translate(
                                  'HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOADING',
                                  'Uploading…'
                              )
                            : translate(
                                  'HallOfFame.UI.Game.ScreenshotUploadPanel.SHARE',
                                  'Upload'
                              )}
                    </Button>
                </>
            )}

            {isDoneUploading && (
                <Button
                    variant='primary'
                    className={styles.screenshotUploadPanelFooterButton}
                    onSelect={discardScreenshot}
                    selectSound='close-menu'>
                    {translate('Common.CLOSE', 'Close')}
                </Button>
            )}
        </div>
    );
}

/**
 * Gets a random congratulation message (displayed in the dialog header).
 */
function getCongratulation(translate: Localization['translate']): string {
    // biome-ignore lint/style/noNonNullAssertion: we have fallback.
    const congratulations = translate(
        'HallOfFame.UI.Game.ScreenshotUploadPanel.CONGRATULATIONS',
        'Nice shot!'
    )!
        // Each message is separated by a newline.
        .split('\n')
        .filter(translation => !translation.startsWith('//'));

    // biome-ignore lint/style/noNonNullAssertion: always has at least 1 element.
    return congratulations[Math.floor(Math.random() * congratulations.length)]!;
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

function getRandomUploadSuccessImage(): string {
    const images = [
        'Media/Game/Climate/Sun.svg',
        'Media/Game/Icons/Content.svg',
        'Media/Game/Icons/Happy.svg',
        'Media/Game/Icons/TouristAttractions.svg',
        'Media/Game/Icons/Trophy.svg',
        'Media/Game/Notifications/LeveledUp.svg'
    ];

    // biome-ignore lint/style/noNonNullAssertion: always has at least 1 element.
    return images[Math.floor(Math.random() * images.length)]!;
}

/**
 * Gets the hint text for the upload progress depending on the state of
 * {@link uploadProgress} (pending, uploading, processing).
 */
function getUploadProgressHintText(
    translate: Localization['translate'],
    uploadProgress: JsonUploadProgress
): string | null {
    if (uploadProgress.uploadProgress == 0) {
        return translate(
            'HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Waiting]',
            'Please wait…'
        );
    }

    if (
        uploadProgress.uploadProgress > 0 &&
        uploadProgress.processingProgress == 0
    ) {
        return translate(
            'HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Uploading]',
            'Uploading…'
        );
    }

    if (uploadProgress.processingProgress > 0 && !uploadProgress.isComplete) {
        return translate(
            'HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Processing]',
            'Processing…'
        );
    }

    if (uploadProgress.isComplete) {
        return translate(
            'HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Complete]',
            'Upload complete!'
        );
    }

    return null;
}

function discardScreenshot(): void {
    trigger('hallOfFame.game', 'clearScreenshot');
}

function uploadScreenshot(): void {
    trigger('hallOfFame.game', 'uploadScreenshot');
}
