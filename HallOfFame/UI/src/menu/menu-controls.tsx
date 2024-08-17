import { trigger } from 'cs2/api';
import {
    type LocElement,
    type Localization,
    LocalizedNumber,
    LocalizedString,
    useLocalization
} from 'cs2/l10n';
import { MenuButton, Tooltip } from 'cs2/ui';
import { format, formatDistanceToNow } from 'date-fns';
import type { ReactElement, ReactNode } from 'react';
import type { Screenshot } from '../common';
import { snappyOnSelect, useDateFnsLocale } from '../utils';
import { FOCUS_DISABLED } from '../vanilla-modules/game-ui/common/focus/focus-key';
import * as styles from './menu-controls.module.scss';
import { useHofMenuState } from './menu-state-hook';

/**
 * Component that renders the menu controls and city/creator information.
 */
export function MenuControls(): ReactElement {
    const [menuState, setMenuState] = useHofMenuState();

    const { translate } = useLocalization();

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
                        {...snappyOnSelect(refreshScreenshot)}>
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
            <MenuControlsCityName screenshot={menuState.screenshot} />

            <MenuControlsScreenshotLabels
                screenshot={menuState.screenshot}
                translate={translate}
            />

            <MenuControlsButtons
                translate={translate}
                isLoading={!menuState.isReadyForNextImage}
                isMenuVisible={menuState.isMenuVisible}
                toggleMenuVisibility={() =>
                    setMenuState({
                        ...menuState,
                        isMenuVisible: !menuState.isMenuVisible
                    })
                }
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
                        {translate(
                            'HallOfFame.UI.Menu.MenuControls.OH_NO',
                            'Oh no!'
                        )}
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

            <LocalizedString
                id='HallOfFame.Common.CITY_BY'
                fallback={'by {CREATOR_NAME}'}
                args={{
                    // .creator should always be defined in this context,
                    // but we use "?." just in case.
                    // biome-ignore lint/style/useNamingConvention: i18n convention
                    CREATOR_NAME: screenshot.creator?.creatorName ?? ''
                }}
            />
        </div>
    );
}

function MenuControlsScreenshotLabels({
    screenshot,
    translate
}: Readonly<{
    screenshot: Screenshot;
    translate: Localization['translate'];
}>): ReactElement {
    const dfnsLocale = useDateFnsLocale();

    // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
    return (
        <div className={styles.menuControlsCityStats}>
            <span>
                <img src='Media/Game/Icons/Trophy.svg' />
                {translate(
                    `Progression.MILESTONE_NAME:${screenshot.cityMilestone}`
                )}
            </span>

            <span>
                <img src='Media/Game/Icons/Population.svg' />
                <LocalizedNumber
                    value={Math.round(screenshot.cityPopulation / 1000) * 1000}
                />
            </span>

            <Tooltip
                tooltip={format(screenshot.createdAt, 'Pp', {
                    locale: dfnsLocale
                })}>
                <span>
                    {formatDistanceToNow(screenshot.createdAt, {
                        locale: dfnsLocale,
                        addSuffix: true
                    })}
                </span>
            </Tooltip>
        </div>
    );
}

function MenuControlsButtons({
    translate,
    isLoading,
    isMenuVisible,
    toggleMenuVisibility
}: Readonly<{
    translate: Localization['translate'];
    isLoading: boolean;
    isMenuVisible: boolean;
    toggleMenuVisibility: () => void;
}>): ReactElement {
    return (
        <div className={styles.menuControlsButtons}>
            <Tooltip
                tooltip={translate(
                    'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Next]'
                )}>
                <MenuButton
                    className={styles.menuControlsButtonsButton}
                    src='coui://uil/Colored/DoubleArrowRightTriangle.svg'
                    tinted={false}
                    focusKey={FOCUS_DISABLED}
                    disabled={isLoading}
                    {...snappyOnSelect(refreshScreenshot)}>
                    {translate(
                        'HallOfFame.UI.Menu.MenuControls.ACTION[Next]',
                        'Next'
                    )}
                </MenuButton>
            </Tooltip>

            <Tooltip
                tooltip={translate(
                    'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Toggle Menu]'
                )}>
                <MenuButton
                    className={styles.menuControlsButtonsButtonCircle}
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
        </div>
    );
}

function refreshScreenshot(): void {
    trigger('hallOfFame.menu', 'refreshScreenshot');
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
