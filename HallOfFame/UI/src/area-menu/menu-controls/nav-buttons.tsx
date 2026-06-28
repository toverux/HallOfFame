import classNames from 'classnames';
import { ControlIcons } from 'cs2/input';
import { LocalizedNumber, LocalizedString, useLocalization } from 'cs2/l10n';
import { MenuButton, Tooltip, type TooltipProps } from 'cs2/ui';
import { memo, type ReactElement } from 'react';
import * as bindings from '../../bindings';
import type { Screenshot } from '../../common';
// biome-ignore lint/correctness/noPrivateImports: svg doesn't have a @public annotation
import ellipsisSolidSrc from '../../icons/fontawesome/ellipsis-solid.svg';
import loveChirperSrc from '../../icons/love-chirper.png';
// biome-ignore-start lint/correctness/noPrivateImports: svgs don't have @public annotations
import doubleArrowRightTriangleSrc from '../../icons/uil/colored/double-arrow-right-triangle.svg';
import eyeClosedSrc from '../../icons/uil/colored/eye-closed.svg';
import eyeOpenSrc from '../../icons/uil/colored/eye-open.svg';
// biome-ignore-end lint/correctness/noPrivateImports: svgs don't have @public annotations
import { snappyOnSelect } from '../../utils';
import * as styles from './nav-buttons.module.scss';
import { useMenuControlsInputAction } from './use-menu-controls-input-action';

const previousScreenshotInputAction = bindings.bindInputAction(
  'hallOfFame.presenter',
  'previousScreenshotInputAction'
);

const nextScreenshotInputAction = bindings.bindInputAction(
  'hallOfFame.presenter',
  'nextScreenshotInputAction'
);

const likeScreenshotInputAction = bindings.bindInputAction(
  'hallOfFame.presenter',
  'likeScreenshotInputAction'
);

const toggleMenuInputAction = bindings.bindInputAction(
  'hallOfFame.presenter',
  'toggleMenuInputAction'
);

export const MenuControlsNextButton = memo(function MenuControlsNextButtonBase({
  isLoading
}: Readonly<{
  isLoading: boolean;
}>): ReactElement {
  const disabled = isLoading;

  const { translate } = useLocalization();

  const { useInputBinding, useInputPhase } = nextScreenshotInputAction;

  const binding = useInputBinding();
  const phase = useInputPhase();

  useMenuControlsInputAction(
    phase,
    // setTimeout is used to give time to the key press .*active class to show briefly before
    // [disabled] is set.
    () => !disabled && (setTimeout(bindings.nextScreenshot), true),
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
        tinted={isLoading}
        disabled={isLoading}
        {...snappyOnSelect(bindings.nextScreenshot)}
      />
    </MenuButtonTooltip>
  );
});

export const MenuControlsPreviousButton = memo(function MenuControlsPreviousButtonBase({
  isLoading,
  hasPreviousScreenshot
}: Readonly<{
  isLoading: boolean;
  hasPreviousScreenshot: boolean;
}>): ReactElement {
  const disabled = isLoading || !hasPreviousScreenshot;

  const { translate } = useLocalization();

  const { useInputBinding, useInputPhase } = previousScreenshotInputAction;

  const binding = useInputBinding();
  const phase = useInputPhase();

  useMenuControlsInputAction(
    phase,
    // setTimeout is used to give time to the key press .*active class to show briefly before
    // [disabled] is set.
    () => !disabled && (setTimeout(bindings.previousScreenshot), true),
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
        tinted={disabled}
        disabled={disabled}
        {...snappyOnSelect(bindings.previousScreenshot)}
      />
    </MenuButtonTooltip>
  );
});

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

  const { translate } = useLocalization();

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
        tinted={false}
        {...snappyOnSelect(toggleMenuVisibility, selectSound)}
      />
    </MenuButtonTooltip>
  );
}

export const MenuControlsLikeButton = memo(function MenuControlsLikeButtonBase({
  screenshot
}: Readonly<{
  screenshot: Screenshot;
}>): ReactElement {
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
            // biome-ignore lint/style/useNamingConvention: i18n convention
            NUMBER: <LocalizedNumber value={screenshot.likesCount} />,
            // biome-ignore lint/style/useNamingConvention: i18n convention
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
});

export const MenuControlsMoreActionsButton = memo(function MenuControlsMoreActionsButtonBase({
  onToggle
}: Readonly<{
  onToggle: () => void;
}>): ReactElement {
  return (
    <MenuButton
      className={styles.button}
      src={ellipsisSolidSrc}
      tinted={true}
      onSelect={onToggle}
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
