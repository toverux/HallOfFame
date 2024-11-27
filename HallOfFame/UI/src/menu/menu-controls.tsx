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
import ellipsisSolidSrc from '../icons/ellipsis-solid.svg';
import flagSolidSrc from '../icons/flag-solid.svg';
import loveChirperSrc from '../icons/love-chirper.png';
import { type ModSettings, snappyOnSelect, useModSettings } from '../utils';
import * as styles from './menu-controls.module.scss';
import { useHofMenuState } from './menu-state-hook';

let lastForcedRefreshIndex = 0;

/**
 * Component that renders the menu controls and city/creator information.
 */
export function MenuControls(): ReactElement {
    return (
        <div className={styles.menuControlsContainer}>
            <MenuControlsContent />
        </div>
    );
}

export function MenuControlsContent(): ReactElement {
    const { translate } = useLocalization();

    const modSettings = useModSettings();

    const [menuState, setMenuState] = useHofMenuState();

    const [showMoreActions, setShowOtherActions] = useState(false);

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
                    isReadyForNextImage={menuState.isReadyForNextImage}
                />
            </div>
        );
    }

    if (!menuState.screenshot) {
        return <></>;
    }

    return (
        <div
            className={`${styles.menuControls} ${styles.menuControlsApplyButtonsOffset}`}
            onMouseLeave={() => setShowOtherActions(false)}>
            <div className={styles.menuControlsSection}>
                <div
                    className={styles.menuControlsSectionButtons}
                    style={{ alignSelf: 'flex-end' }}>
                    <MenuControlsNextButton
                        translate={translate}
                        isLoading={!menuState.isReadyForNextImage}
                    />

                    <MenuControlsPreviousButton
                        translate={translate}
                        isLoading={!menuState.isReadyForNextImage}
                        hasPreviousScreenshot={menuState.hasPreviousScreenshot}
                    />

                    <MenuControlsToggleMenuVisibilityButton
                        translate={translate}
                        isMenuVisible={menuState.isMenuVisible}
                        toggleMenuVisibility={() =>
                            setMenuState({
                                ...menuState,
                                isMenuVisible: !menuState.isMenuVisible
                            })
                        }
                    />
                </div>

                <div
                    className={styles.menuControlsSectionContent}
                    style={{ alignSelf: 'flex-start' }}>
                    <MenuControlsCityName screenshot={menuState.screenshot} />

                    <MenuControlsScreenshotLabels
                        translate={translate}
                        modSettings={modSettings}
                        screenshot={menuState.screenshot}
                    />
                </div>
            </div>

            <div className={styles.menuControlsSection}>
                <div className={styles.menuControlsSectionButtons}>
                    <MenuControlsFavoriteButton
                        screenshot={menuState.screenshot}
                    />
                </div>

                <div
                    className={`${styles.menuControlsSectionContent} ${styles.menuControlsFavoriteCount}`}>
                    <span className={styles.menuControlsFavoriteCountNumber}>
                        {menuState.screenshot.favoritesCount < 1000
                            ? menuState.screenshot.favoritesCount
                            : `${(
                                  menuState.screenshot.favoritesCount / 1000
                              ).toFixed(1)} k`}
                    </span>
                    &thinsp;
                    {translate(
                        menuState.screenshot.favoritesCount == 0
                            ? 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Zero]'
                            : menuState.screenshot.favoritesCount == 1
                              ? 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Singular]'
                              : 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Plural]'
                    )}
                </div>
            </div>

            <div
                className={`${styles.menuControlsSection} ${styles.menuControlsSectionOtherActions}`}>
                <div className={styles.menuControlsSectionButtons}>
                    <MenuButton
                        className={styles.menuControlsSectionButtonsButton}
                        src={ellipsisSolidSrc}
                        tinted={true}
                        onSelect={() => setShowOtherActions(!showMoreActions)}
                    />
                </div>

                <div
                    className={`${styles.menuControlsSectionContent} ${showMoreActions ? styles.menuControlsSectionContentSlideIn : ''}`}>
                    <Tooltip
                        direction='down'
                        tooltip={translate(
                            'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Report]'
                        )}>
                        <Button
                            variant='menu'
                            src={flagSolidSrc}
                            tinted={true}
                            onSelect={reportScreenshot}
                            selectSound='bulldoze'>
                            <span>
                                {translate(
                                    'HallOfFame.UI.Menu.MenuControls.ACTION[Report]'
                                )}
                            </span>
                        </Button>
                    </Tooltip>

                    <Tooltip
                        direction='down'
                        tooltip={translate(
                            'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Open Mod Settings]'
                        )}>
                        <Button
                            className={
                                styles.menuControlsSectionContentButtonSettings
                            }
                            variant='menu'
                            src='Media/Glyphs/Gear.svg'
                            tinted={true}
                            onSelect={() => openModSettings('General')}
                        />
                    </Tooltip>
                </div>
            </div>
        </div>
    );
}

function MenuControlsCityName({
    screenshot
}: Readonly<{
    screenshot: Screenshot;
}>): ReactElement {
    if (!screenshot.creator) {
        console.warn(
            `HoF: No creator information for screenshot ${screenshot.id}`
        );
    }

    return (
        <div className={styles.menuControlsNames}>
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
        <div className={styles.menuControlsSectionScreenshotLabels}>
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

function MenuControlsNextButton({
    translate,
    isLoading
}: Readonly<{
    translate: Localization['translate'];
    isLoading: boolean;
}>): ReactElement {
    return (
        <Tooltip
            direction='right'
            tooltip={translate(
                'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Next]'
            )}>
            <MenuButton
                className={`${styles.menuControlsSectionButtonsButton} ${styles.menuControlsSectionButtonsButtonNext}`}
                src='coui://uil/Colored/DoubleArrowRightTriangle.svg'
                tinted={isLoading}
                disabled={isLoading}
                {...snappyOnSelect(nextScreenshot)}
            />
        </Tooltip>
    );
}

function MenuControlsPreviousButton({
    translate,
    isLoading,
    hasPreviousScreenshot
}: Readonly<{
    translate: Localization['translate'];
    isLoading: boolean;
    hasPreviousScreenshot: boolean;
}>): ReactElement {
    return (
        <Tooltip
            direction='right'
            tooltip={translate(
                'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Previous]'
            )}>
            <MenuButton
                className={`${styles.menuControlsSectionButtonsButton} ${styles.menuControlsSectionButtonsButtonPrevious}`}
                src='coui://uil/Colored/DoubleArrowRightTriangle.svg'
                tinted={isLoading || !hasPreviousScreenshot}
                disabled={isLoading || !hasPreviousScreenshot}
                {...snappyOnSelect(previousScreenshot)}
            />
        </Tooltip>
    );
}

function MenuControlsToggleMenuVisibilityButton({
    translate,
    isMenuVisible,
    toggleMenuVisibility
}: Readonly<{
    translate: Localization['translate'];
    isMenuVisible: boolean;
    toggleMenuVisibility: () => void;
}>): ReactElement {
    return (
        <Tooltip
            direction='right'
            tooltip={translate(
                'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Toggle Menu]'
            )}>
            <MenuButton
                className={styles.menuControlsSectionButtonsButton}
                src={
                    isMenuVisible
                        ? 'coui://uil/Colored/EyeOpen.svg'
                        : 'coui://uil/Colored/EyeClosed.svg'
                }
                tinted={false}
                {...snappyOnSelect(
                    toggleMenuVisibility,
                    isMenuVisible ? 'close-menu' : 'open-menu'
                )}
            />
        </Tooltip>
    );
}

function MenuControlsFavoriteButton({
    screenshot
}: Readonly<{
    screenshot: Screenshot;
}>): ReactElement {
    return (
        <Tooltip
            direction='right'
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
                className={`${styles.menuControlsSectionButtonsButton} ${styles.menuControlsSectionButtonsButtonFavorite} ${screenshot.isFavorite ? styles.menuControlsSectionButtonsButtonFavoriteActive : ''}`}
                src={loveChirperSrc}
                tinted={false}
                onSelect={favoriteScreenshot}
                selectSound={screenshot.isFavorite ? 'chirp-event' : 'xp-event'}
            />
        </Tooltip>
    );
}

function MenuControlsError({
    translate,
    error,
    isReadyForNextImage
}: Readonly<{
    translate: Localization['translate'];
    error: LocalizedString;
    isReadyForNextImage: boolean;
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
                    <strong>{translate('HallOfFame.Common.OOPS')}</strong>
                    {translate(
                        'HallOfFame.UI.Menu.MenuControls.COULD_NOT_LOAD_IMAGE'
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
                {translate(
                    'HallOfFame.UI.Menu.MenuControls.GAMEPLAY_NOT_AFFECTED'
                )}
            </strong>

            <MenuButton
                src='Media/Glyphs/ArrowCircular.svg'
                disabled={!isReadyForNextImage}
                {...snappyOnSelect(nextScreenshot)}>
                {translate('HallOfFame.UI.Menu.MenuControls.ACTION[Retry]')}
            </MenuButton>
        </div>
    );
}

function openModSettings(tab: string): void {
    trigger('hallOfFame', 'openModSettings', tab);
}

function previousScreenshot(): void {
    trigger('hallOfFame.menu', 'previousScreenshot');
}

function nextScreenshot(): void {
    trigger('hallOfFame.menu', 'nextScreenshot');
}

function reportScreenshot(): void {
    trigger('hallOfFame.menu', 'reportScreenshot');
}

function favoriteScreenshot(): void {
    trigger('hallOfFame.menu', 'favoriteScreenshot');
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
