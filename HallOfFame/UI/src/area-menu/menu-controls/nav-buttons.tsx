import classNames from 'classnames';
import { ControlIcons } from 'cs2/input';
import { LocalizedNumber, LocalizedString } from 'cs2/l10n';
import { MenuButton } from 'cs2/ui';
import { memo, type ReactElement, useContext } from 'react';
import type { Screenshot } from '../../common';
import { Tooltip, type TooltipProps } from '../../components/tooltip';
import ellipsisSolidSrc from '../../icons/fontawesome/ellipsis-solid.svg';
import loveChirperSrc from '../../icons/love-chirper.png';
import doubleArrowRightTriangleSrc from '../../icons/uil/double-arrow-right-triangle.svg';
import eyeClosedSrc from '../../icons/uil/eye-closed.svg';
import eyeOpenSrc from '../../icons/uil/eye-open.svg';
import { snappyOnSelect, useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { DropdownContext } from '../../vanilla-modules/game-ui/common/input/dropdown/dropdown';
import { useMenuControlsInputAction } from './use-menu-controls-input-action';
import * as styles from './nav-buttons.module.scss';

const previousScreenshotInputAction = bindings.bindInputAction(
  'hallOfFame.slideshow',
  'previousScreenshotInputAction'
);

const nextScreenshotInputAction = bindings.bindInputAction(
  'hallOfFame.slideshow',
  'nextScreenshotInputAction'
);

const likeScreenshotInputAction = bindings.bindInputAction(
  'hallOfFame.slideshow',
  'likeScreenshotInputAction'
);

const toggleMenuInputAction = bindings.bindInputAction(
  'hallOfFame.slideshow',
  'toggleMenuInputAction'
);

/**
 * The buttons' icons that are not on screen when the controls mount, for the preloading the
 * controls do on their behalf.
 *
 * Only the eye qualifies: every other button shows its icon from the first frame, while the toggle
 * starts on the open eye, so the closed one would not be fetched until the player first hides the
 * menu, on the very frame it is meant to be drawn.
 */
// oxlint-disable-next-line react/only-export-components - no Fast Refresh in a Cohtml bundle
export const navButtonsPreloadedIcons: readonly string[] = [eyeClosedSrc];

export const MenuControlsNextButton = memo(
  ({
    isLoading
  }: Readonly<{
    isLoading: boolean;
  }>): ReactElement => {
    const disabled = isLoading;

    const translate = useTranslate();

    const { useInputBinding, useInputPhase } = nextScreenshotInputAction;

    const binding = useInputBinding();
    const phase = useInputPhase();

    useMenuControlsInputAction(
      phase,
      // SetTimeout is used to give time to the key press .*active class to show briefly before
      // [disabled] is set.
      () => !disabled && (setTimeout(bindings.nextScreenshot, 0), true),
      'select-item'
    );

    const activeClass = phase == 'Performed' && !disabled ? styles.buttonActive : '';

    return (
      <MenuButtonTooltip
        binding={binding}
        tooltip={translate('HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Next]')}>
        <MenuButton
          className={classNames(styles.button, styles.buttonNext, activeClass)}
          src={doubleArrowRightTriangleSrc}
          tinted={true}
          disabled={isLoading}
          {...snappyOnSelect(bindings.nextScreenshot)}
        />
      </MenuButtonTooltip>
    );
  }
);

export const MenuControlsPreviousButton = memo(
  ({
    isLoading,
    hasPreviousScreenshot
  }: Readonly<{
    isLoading: boolean;
    hasPreviousScreenshot: boolean;
  }>): ReactElement => {
    const disabled = isLoading || !hasPreviousScreenshot;

    const translate = useTranslate();

    const { useInputBinding, useInputPhase } = previousScreenshotInputAction;

    const binding = useInputBinding();
    const phase = useInputPhase();

    useMenuControlsInputAction(
      phase,
      // SetTimeout is used to give time to the key press .*active class to show briefly before
      // [disabled] is set.
      () => !disabled && (setTimeout(bindings.previousScreenshot, 0), true),
      'select-item'
    );

    const activeClass = phase == 'Performed' && !disabled ? styles.buttonActive : '';

    return (
      <MenuButtonTooltip
        binding={binding}
        tooltip={translate('HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Previous]')}>
        <MenuButton
          className={classNames(styles.button, styles.buttonPrevious, activeClass)}
          src={doubleArrowRightTriangleSrc}
          tinted={true}
          disabled={disabled}
          {...snappyOnSelect(bindings.previousScreenshot)}
        />
      </MenuButtonTooltip>
    );
  }
);

export const MenuControlsToggleMenuVisibilityButton = memo(
  MenuControlsToggleMenuVisibilityButtonBase
);

function MenuControlsToggleMenuVisibilityButtonBase({
  isMenuVisible,
  toggleMenuVisibility
}: Readonly<{
  isMenuVisible: boolean;
  toggleMenuVisibility: () => void;
}>): ReactElement {
  const selectSound = isMenuVisible ? 'close-menu' : 'open-menu';

  const translate = useTranslate();

  const { useInputBinding, useInputPhase } = toggleMenuInputAction;

  const binding = useInputBinding();
  const phase = useInputPhase();

  useMenuControlsInputAction(phase, toggleMenuVisibility, selectSound);

  const activeClass = phase == 'Performed' ? styles.buttonActive : '';

  return (
    <MenuButtonTooltip
      binding={binding}
      tooltip={translate('HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Toggle Menu]')}>
      <MenuButton
        className={classNames(styles.button, activeClass)}
        src={isMenuVisible ? eyeOpenSrc : eyeClosedSrc}
        tinted={true}
        {...snappyOnSelect(toggleMenuVisibility, selectSound)}
      />
    </MenuButtonTooltip>
  );
}

export const MenuControlsLikeButton = memo(
  ({
    screenshot
  }: Readonly<{
    screenshot: Screenshot;
  }>): ReactElement => {
    const selectSound = screenshot.isLiked ? 'chirp-event' : 'xp-event';

    const { useInputBinding, useInputPhase } = likeScreenshotInputAction;

    const binding = useInputBinding();
    const phase = useInputPhase();

    useMenuControlsInputAction(phase, bindings.likeScreenshot, selectSound);

    const activeClass =
      phase == 'Performed'
        ? screenshot.isLiked
          ? styles.buttonLikeLikedActive
          : styles.buttonActive
        : '';

    return (
      <MenuButtonTooltip
        binding={binding}
        tooltip={
          <LocalizedString
            id={
              screenshot.isLiked
                ? 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Remove Like]'
                : screenshot.likesCount == 0
                  ? 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Like Zero]'
                  : screenshot.likesCount == 1
                    ? 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Like Singular]'
                    : 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Like Plural]'
            }
            args={{
              NUMBER: <LocalizedNumber value={screenshot.likesCount} />,
              LIKING_PERCENTAGE: <LocalizedNumber value={screenshot.likingPercentage} />
            }}
          />
        }>
        <MenuButton
          className={classNames(
            styles.button,
            styles.buttonLike,
            {
              [styles.buttonLikeLiked]: screenshot.isLiked
            },
            activeClass
          )}
          src={loveChirperSrc}
          tinted={false}
          onSelect={bindings.likeScreenshot}
          selectSound={selectSound}
        />
      </MenuButtonTooltip>
    );
  }
);

/**
 * The toggle of the more-actions menu, driven through the enclosing dropdown's context rather than
 * through a prop: the vanilla `DropdownToggle` renders a button of its own, and this one has to be
 * one of the round buttons in the column.
 *
 * The select sound is dropped because the vanilla `toggle` plays the dropdown's own, and the two
 * would otherwise land together.
 */
export const MenuControlsMoreActionsButton = memo((): ReactElement => {
  const { visible, toggle } = useContext(DropdownContext);

  return (
    <MenuButton
      className={classNames(styles.button, { [styles.buttonActive]: visible })}
      src={ellipsisSolidSrc}
      tinted={true}
      selectSound={null}
      onSelect={toggle}
    />
  );
});

function MenuButtonTooltip({
  tooltip,
  binding,
  children
}: Readonly<{
  tooltip: TooltipProps['tooltip'];
  binding: bindings.ProxyBinding;
  children: TooltipProps['children'];
}>): ReactElement {
  return (
    <Tooltip
      direction='right'
      tooltip={
        <div className={styles.buttonTooltip}>
          {tooltip}

          <ControlIcons bindings={[binding.binding]} modifiers={binding.modifiers} />
        </div>
      }>
      {children}
    </Tooltip>
  );
}
