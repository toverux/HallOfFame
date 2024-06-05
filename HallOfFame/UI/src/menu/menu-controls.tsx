import { LocalizedNumber, LocalizedString, useLocalization } from 'cs2/l10n';
import { MenuButton, Tooltip } from 'cs2/ui';
import { formatDistanceToNow } from 'date-fns';
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

    // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
    return (
        <div className={styles.menuControls}>
            <div className={styles.menuControlsCityName}>
                <strong>{'Colossal City'}</strong>
                <LocalizedString
                    id='HallOfFame.Common.CITY_BY'
                    fallback={'by {CREATOR_NAME}'}
                    // biome-ignore lint/style/useNamingConvention: i18n
                    args={{ CREATOR_NAME: 'toverux' }}
                />
            </div>

            <div className={styles.menuControlsCityStats}>
                <span>
                    <img src='Media/Game/Icons/Trophy.svg' />
                    {translate(`Progression.MILESTONE_NAME:${0}`)}
                </span>
                <span>
                    <img src='Media/Game/Icons/Population.svg' />
                    <LocalizedNumber value={0} />
                </span>
                <span>
                    {formatDistanceToNow(new Date(), {
                        locale: dfnsLocale,
                        addSuffix: true
                    })}
                </span>
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
                        focusKey={FOCUS_DISABLED}>
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
