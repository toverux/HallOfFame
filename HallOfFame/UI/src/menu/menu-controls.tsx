import { trigger } from 'cs2/api';
import {
    type LocElement,
    type Localization,
    LocalizedNumber,
    LocalizedString,
    useLocalization
} from 'cs2/l10n';
import { Button, MenuButton, Tooltip } from 'cs2/ui';
import { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import type { Screenshot } from '../common';
import loveChirperSrc from '../icons/love-chirper.png';
import { type ModSettings, snappyOnSelect, useModSettings } from '../utils';
import { FOCUS_DISABLED } from '../vanilla-modules/game-ui/common/focus/focus-key';
import * as styles from './menu-controls.module.scss';
import { useHofMenuState } from './menu-state-hook';

let lastForcedRefreshIndex = 0;

/**
 * Component that renders the menu controls and city/creator information.
 */
export function MenuControls(): ReactElement {
    const modSettings = useModSettings();
    const [menuState, setMenuState] = useHofMenuState();

    const { translate } = useLocalization();

    useEffect(() => {
        if (menuState.forcedRefreshIndex != lastForcedRefreshIndex) {
            setTimeout(() => nextScreenshot(), 500);
            lastForcedRefreshIndex = menuState.forcedRefreshIndex;
        }
    }, [menuState.forcedRefreshIndex]);

    if (menuState.error) {
        // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
        return (
            <div className={styles.menuControls}>
                <MenuControlsError
                    translate={translate}
                    error={menuState.error}
                />

                <div className={styles.menuControlsButtons}>
                    <MenuButton
                        className={styles.menuControlsButtonsButton}
                        src='Media/Glyphs/ArrowCircular.svg'
                        focusKey={FOCUS_DISABLED}
                        disabled={!menuState.isReadyForNextImage}
                        {...snappyOnSelect(nextScreenshot)}>
                        {translate(
                            'HallOfFame.UI.Menu.MenuControls.ACTION[Retry]',
                            'Retry'
                        )}
                    </MenuButton>
                </div>
            </div>
        );
    }

    if (!menuState.screenshot) {
        return <></>;
    }

    return (
        <div className={styles.menuControls}>
            <MenuControlsCityName
                translate={translate}
                screenshot={menuState.screenshot}
            />

            <MenuControlsScreenshotLabels
                translate={translate}
                modSettings={modSettings}
                screenshot={menuState.screenshot}
            />

            <MenuControlsButtons
                translate={translate}
                hasPreviousScreenshot={menuState.hasPreviousScreenshot}
                isLoading={!menuState.isReadyForNextImage}
                isMenuVisible={menuState.isMenuVisible}
                toggleMenuVisibility={() =>
                    setMenuState({
                        ...menuState,
                        isMenuVisible: !menuState.isMenuVisible
                    })
                }
                screenshot={menuState.screenshot}
            />
        </div>
    );
}

function MenuControlsError({
    translate,
    error
}: Readonly<{
    translate: Localization['translate'];
    error: LocalizedString;
}>): ReactElement {
    return (
        <div className={styles.menuControlsError}>
            <div className={styles.menuControlsErrorHeader}>
                <div
                    className={styles.menuControlsErrorHeaderImage}
                    style={{
                        backgroundImage:
                            'url(Media/Game/Icons/AdvisorTrafficAccident.svg)'
                    }}
                />
                <div className={styles.menuControlsErrorHeaderText}>
                    <strong>
                        {translate('HallOfFame.Common.OOPS', 'Oh no!')}
                    </strong>
                    {translate(
                        'HallOfFame.UI.Menu.MenuControls.COULD_NOT_LOAD_IMAGE',
                        'Hall of Fame could not load the image.'
                    )}
                </div>
            </div>

            <LocalizedString
                id={error.id}
                fallback={error.value}
                args={{
                    // biome-ignore lint/style/useNamingConvention: i18n convention
                    ERROR_MESSAGE: locElementToReactNode(
                        error.args?.ERROR_MESSAGE,
                        'Unknown error'
                    )
                }}
            />

            <strong className={styles.menuControlsErrorGameplayNotAffected}>
                <LocalizedString
                    id='HallOfFame.UI.Menu.MenuControls.GAMEPLAY_NOT_AFFECTED'
                    fallback='Gameplay is not affected, it is safe to launch a game.'
                />
            </strong>
        </div>
    );
}

// Static variable to track if we should peek at the city name menu controls,
// only once when the mod is loaded. This is a UX feature to help the user
// discover the city name menu controls.
let shouldPeekAtCityNameMenuControls = true;

function MenuControlsCityName({
    translate,
    screenshot
}: Readonly<{
    translate: Localization['translate'];
    screenshot: Screenshot;
}>): ReactElement {
    const [peekAtMenuControls, setPeekAtMenuControls] = useState(false);

    // When the component is first mounted, show the city name menu controls
    // briefly to help the user discover them.
    useEffect(() => {
        if (shouldPeekAtCityNameMenuControls) {
            setTimeout(() => setPeekAtMenuControls(true), 100);
            setTimeout(() => setPeekAtMenuControls(false), 4000);

            shouldPeekAtCityNameMenuControls = false;
        }
    }, []);

    if (!screenshot.creator) {
        console.warn(
            `HoF: No creator information for screenshot ${screenshot.id}`
        );
    }

    return (
        <div
            className={`${styles.menuControlsNames} ${peekAtMenuControls ? styles.menuControlsNamesShowMenu : ''}`}>
            <div className={styles.menuControlsNamesMenu}>
                <Tooltip
                    tooltip={translate(
                        'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Report Abuse]',
                        'Report inappropriate content'
                    )}>
                    <Button
                        variant='round'
                        onSelect={reportScreenshot}
                        selectSound='bulldoze'
                        className={styles.menuControlsNamesMenuButton}>
                        <svg
                            xmlns='http://www.w3.org/2000/svg'
                            viewBox='0 0 448 512'>
                            {/* Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc. */}
                            <path d='M64 32C64 14.3 49.7 0 32 0S0 14.3 0 32L0 64 0 368 0 480c0 17.7 14.3 32 32 32s32-14.3 32-32l0-128 64.3-16.1c41.1-10.3 84.6-5.5 122.5 13.4c44.2 22.1 95.5 24.8 141.7 7.4l34.7-13c12.5-4.7 20.8-16.6 20.8-30l0-247.7c0-23-24.2-38-44.8-27.7l-9.6 4.8c-46.3 23.2-100.8 23.2-147.1 0c-35.1-17.6-75.4-22-113.5-12.5L64 48l0-16z' />
                        </svg>
                    </Button>
                </Tooltip>
            </div>

            <div className={styles.menuControlsNamesCity}>
                {screenshot.cityName}
            </div>

            {/* screenshot.creator should always be defined in this context, but
                we use "?." just in case */}
            {screenshot.creator?.creatorName && (
                <LocalizedString
                    id='HallOfFame.Common.CITY_BY'
                    fallback={'by {CREATOR_NAME}'}
                    args={{
                        // biome-ignore lint/style/useNamingConvention: i18n convention
                        CREATOR_NAME: screenshot.creator.creatorName ?? ''
                    }}
                />
            )}
        </div>
    );
}

function MenuControlsScreenshotLabels({
    translate,
    modSettings,
    screenshot
}: Readonly<{
    translate: Localization['translate'];
    modSettings: ModSettings;
    screenshot: Screenshot;
}>): ReactElement {
    // Do not show the pop/milestone labels if this is an empty map screenshot,
    // which is likely when the pop is 0 and the milestone is 0 (Founding) or 20
    // (Megalopolis, i.e. creative mode).
    const isPristineWilderness =
        screenshot.cityPopulation == 0 &&
        (screenshot.cityMilestone == 0 || screenshot.cityMilestone == 20);

    // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
    return (
        <div className={styles.menuControlsCityStats}>
            {isPristineWilderness ? (
                <span>
                    <img src='Media/Game/Icons/NaturalResources.svg' />
                    {translate(
                        `HallOfFame.UI.Menu.MenuControls.LABEL[Pristine Wilderness]`,
                        `Pristine wilderness`
                    )}
                </span>
            ) : (
                <>
                    <span>
                        <img src='Media/Game/Icons/Trophy.svg' />
                        {translate(
                            `Progression.MILESTONE_NAME:${screenshot.cityMilestone}`,
                            `???`
                        )}
                    </span>

                    <span>
                        <img src='Media/Game/Icons/Population.svg' />
                        {formatBigNumber(screenshot.cityPopulation, translate)}
                    </span>
                </>
            )}

            {modSettings.showViewCount && (
                <Tooltip
                    tooltip={
                        <LocalizedString
                            id='HallOfFame.UI.Menu.MenuControls.LABEL_TOOLTIP[Views]'
                            fallback='{NUMBER} views ({VIEWS_PER_DAY} views/day)'
                            args={{
                                // biome-ignore lint/style/useNamingConvention: i18n convention
                                NUMBER: (
                                    <LocalizedNumber
                                        value={screenshot.viewsCount}
                                    />
                                ),
                                // biome-ignore lint/style/useNamingConvention: i18n convention
                                VIEWS_PER_DAY: (
                                    <LocalizedNumber
                                        value={screenshot.viewsPerDay}
                                    />
                                )
                            }}
                        />
                    }>
                    <span>
                        <img src='coui://uil/Colored/EyeOpen.svg' />
                        {formatBigNumber(screenshot.viewsCount, translate)}
                    </span>
                </Tooltip>
            )}

            <Tooltip tooltip={screenshot.createdAtFormatted}>
                <span>{screenshot.createdAtFormattedDistance}</span>
            </Tooltip>
        </div>
    );
}

function MenuControlsButtons({
    translate,
    hasPreviousScreenshot,
    isLoading,
    isMenuVisible,
    toggleMenuVisibility,
    screenshot
}: Readonly<{
    translate: Localization['translate'];
    hasPreviousScreenshot: boolean;
    isLoading: boolean;
    isMenuVisible: boolean;
    toggleMenuVisibility: () => void;
    screenshot: Screenshot;
}>): ReactElement {
    return (
        <div className={styles.menuControlsButtons}>
            <div className={styles.menuControlsButtonsButtonGroup}>
                <Tooltip
                    tooltip={translate(
                        'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Previous]',
                        'Show the previous image'
                    )}>
                    <MenuButton
                        className={`${styles.menuControlsButtonsButtonIcon} ${styles.menuControlsButtonsButtonPrevious}`}
                        src='coui://uil/Colored/DoubleArrowRightTriangle.svg'
                        tinted={isLoading || !hasPreviousScreenshot}
                        focusKey={FOCUS_DISABLED}
                        disabled={isLoading || !hasPreviousScreenshot}
                        {...snappyOnSelect(previousScreenshot)}
                    />
                </Tooltip>

                <Tooltip
                    tooltip={translate(
                        'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Next]'
                    )}>
                    <MenuButton
                        className={styles.menuControlsButtonsButton}
                        src='coui://uil/Colored/DoubleArrowRightTriangle.svg'
                        tinted={isLoading}
                        focusKey={FOCUS_DISABLED}
                        disabled={isLoading}
                        {...snappyOnSelect(nextScreenshot)}>
                        {translate(
                            'HallOfFame.UI.Menu.MenuControls.ACTION[Next]',
                            'Show a new image'
                        )}
                    </MenuButton>
                </Tooltip>
            </div>

            <Tooltip
                tooltip={translate(
                    'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Toggle Menu]',
                    'Toggle menu visibility'
                )}>
                <MenuButton
                    className={styles.menuControlsButtonsButtonIcon}
                    src={
                        isMenuVisible
                            ? 'coui://uil/Colored/EyeOpen.svg'
                            : 'coui://uil/Colored/EyeClosed.svg'
                    }
                    tinted={false}
                    focusKey={FOCUS_DISABLED}
                    {...snappyOnSelect(
                        toggleMenuVisibility,
                        isMenuVisible ? 'close-menu' : 'open-menu'
                    )}
                />
            </Tooltip>

            <Tooltip
                tooltip={
                    <LocalizedString
                        id={
                            screenshot.isFavorite
                                ? 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Unfavorite]'
                                : screenshot.favoritesCount == 0
                                  ? 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Favorite Zero]'
                                  : screenshot.favoritesCount == 1
                                    ? 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Favorite Singular]'
                                    : 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Favorite Plural]'
                        }
                        fallback={
                            screenshot.isFavorite
                                ? 'Unfavorite this image'
                                : 'Favorite this image'
                        }
                        args={{
                            // biome-ignore lint/style/useNamingConvention: i18n convention
                            NUMBER: (
                                <LocalizedNumber
                                    value={screenshot.favoritesCount}
                                />
                            ),
                            // biome-ignore lint/style/useNamingConvention: i18n convention
                            FAVORITES_PER_DAY: (
                                <LocalizedNumber
                                    value={screenshot.favoritesPerDay}
                                />
                            )
                        }}
                    />
                }>
                <MenuButton
                    className={`${styles.menuControlsButtonsButton} ${styles.menuControlsButtonsButtonFavorite} ${screenshot.isFavorite ? styles.menuControlsButtonsButtonFavoriteActive : ''}`}
                    src={loveChirperSrc}
                    tinted={false}
                    focusKey={FOCUS_DISABLED}
                    onSelect={favoriteScreenshot}
                    selectSound={
                        screenshot.isFavorite ? 'chirp-event' : 'xp-event'
                    }>
                    {screenshot.favoritesCount < 1000
                        ? screenshot.favoritesCount
                        : `${(screenshot.favoritesCount / 1000).toFixed(1)}k`}
                </MenuButton>
            </Tooltip>
        </div>
    );
}

function previousScreenshot(): void {
    trigger('hallOfFame.menu', 'previousScreenshot');
}

function nextScreenshot(): void {
    trigger('hallOfFame.menu', 'nextScreenshot');
}

function favoriteScreenshot(): void {
    trigger('hallOfFame.menu', 'favoriteScreenshot');
}

function reportScreenshot(): void {
    trigger('hallOfFame.menu', 'reportScreenshot');
}

function locElementToReactNode(
    element: LocElement | null | undefined,
    fallback: ReactNode
): ReactElement {
    return element?.__Type == 'Game.UI.Localization.LocalizedString' ? (
        <LocalizedString id={element.id} fallback={element.value} />
    ) : (
        <>{fallback}</>
    );
}

/**
 * Formats a big number to a human-readable string, applying special formatting
 * rules depending on the number's magnitude.
 */
function formatBigNumber(
    num: number,
    translate: Localization['translate']
): string {
    let numStr: string;

    if (num < 1000) {
        // No formatting on small numbers.
        numStr = num.toString();
    } else if (num < 10_000) {
        // Formats as "9.9K", precision .1K.
        numStr = `${(num / 1000).toFixed(1)} K`;
    } else if (num < 1_000_000) {
        // Formats as "99K", rounded, precision 1K.
        numStr = `${Math.round(num / 1000)} K`;
    } else {
        // Formats as "9.9M", precision .1M.
        numStr = `${(num / 1_000_000).toFixed(1)} M`;
    }

    return (
        numStr
            // Remove trailing zeros.
            .replace('.0', '')
            // Replace decimal separator.
            // biome-ignore lint/style/noNonNullAssertion: fallback value
            .replace('.', translate('Common.DECIMAL_SEPARATOR', '.')!)
    );
}
