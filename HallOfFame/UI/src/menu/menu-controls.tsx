import { trigger } from 'cs2/api';
import { LocalizedNumber, LocalizedString, useLocalization } from 'cs2/l10n';
import { MenuButton, Tooltip } from 'cs2/ui';
import { format, formatDistanceToNow } from 'date-fns';
import type { ReactElement } from 'react';
import { snappyOnSelect, useDateFnsLocale } from '../utils';
import { FOCUS_DISABLED } from '../vanilla-modules/game-ui/common/focus/focus-key';
import * as styles from './menu-controls.module.scss';
import { useHofMenuState } from './menu-state-hook';

/**
 * Component that renders the menu controls and city/creator information.
 */
export function MenuControls(): ReactElement {
    const { translate } = useLocalization();

    const dfnsLocale = useDateFnsLocale();

    const [menuState, setMenuState] = useHofMenuState();

    if (!menuState.screenshot) {
        return <></>;
    }

    if (!menuState.screenshot.creator) {
        console.warn(
            `HoF: No creator information for screenshot ${menuState.screenshot.id}`
        );
    }

    // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
    return (
        <div className={styles.menuControls}>
            <div className={styles.menuControlsNames}>
                <div className={styles.menuControlsNamesCity}>
                    {menuState.screenshot.cityName}
                </div>

                <LocalizedString
                    id='HallOfFame.Common.CITY_BY'
                    fallback={'by {CREATOR_NAME}'}
                    args={{
                        // .creator should always be defined in this context,
                        // but we use "?." just in case.
                        // biome-ignore lint/style/useNamingConvention: i18n
                        CREATOR_NAME:
                            menuState.screenshot.creator?.creatorName ?? ''
                    }}
                />
            </div>

            <div className={styles.menuControlsCityStats}>
                <span>
                    <img src='Media/Game/Icons/Trophy.svg' />
                    {translate(
                        `Progression.MILESTONE_NAME:${menuState.screenshot.cityMilestone}`
                    )}
                </span>
                <span>
                    <img src='Media/Game/Icons/Population.svg' />
                    <LocalizedNumber
                        value={
                            Math.round(
                                menuState.screenshot.cityPopulation / 1000
                            ) * 1000
                        }
                    />
                </span>
                <Tooltip
                    tooltip={format(menuState.screenshot.createdAt, 'Pp', {
                        locale: dfnsLocale
                    })}>
                    <span>
                        {formatDistanceToNow(menuState.screenshot.createdAt, {
                            locale: dfnsLocale,
                            addSuffix: true
                        })}
                    </span>
                </Tooltip>
            </div>

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
                        disabled={!menuState.isReadyForNextImage}
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
                            menuState.isMenuVisible
                                ? 'coui://uil/Colored/EyeOpen.svg'
                                : 'coui://uil/Colored/EyeClosed.svg'
                        }
                        tinted={false}
                        focusKey={FOCUS_DISABLED}
                        {...snappyOnSelect(
                            () =>
                                setMenuState({
                                    ...menuState,
                                    isMenuVisible: !menuState.isMenuVisible
                                }),
                            menuState.isMenuVisible ? 'close-menu' : 'open-menu'
                        )}
                    />
                </Tooltip>
            </div>
        </div>
    );
}

function refreshScreenshot(): void {
    trigger('hallOfFame.menu', 'refreshScreenshot');
}
