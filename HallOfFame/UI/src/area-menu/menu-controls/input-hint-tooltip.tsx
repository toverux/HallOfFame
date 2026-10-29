import classNames from 'classnames';
import { ControlIcons, type ShortInputPathOption } from 'cs2/input';
import type { ReactElement, ReactNode } from 'react';
import { Tooltip, type TooltipProps } from '../../components/tooltip';
import type * as bindings from '../../utils/bindings';
import * as styles from './input-hint-tooltip.module.scss';

// `ShortInputPathOption.FallbackToLong`: the enum is declared in `cs2/input` but missing from the
// module at runtime.
const shortNameFallbackToLong: ShortInputPathOption = 1;

// Solid arrows for the arrow keys, whose short names in the game are outlined arrows: they weigh
// as much as a key's name, where the font draws the plain ones thin and small.
const solidArrows: ReadonlyMap<string, string> = new Map([
  ['leftArrow', '⬅'],
  ['rightArrow', '➡'],
  ['upArrow', '⬆'],
  ['downArrow', '⬇']
]);

/**
 * A tooltip followed by the key of the input action doing what the hovered control does.
 * The key reads alone, or followed by `bindingLabel` naming its action when the tooltip does not.
 */
export function MenuControlsInputHintTooltip({
  tooltip,
  binding,
  bindingLabel,
  direction,
  children
}: Readonly<{
  tooltip: TooltipProps['tooltip'];
  binding: bindings.ProxyBinding;
  bindingLabel?: ReactNode;
  direction: TooltipProps['direction'];
  children: TooltipProps['children'];
}>): ReactElement {
  return (
    <Tooltip
      direction={direction}
      tooltip={
        <div className={styles.inputHintTooltip}>
          {tooltip}

          <MenuControlsInputHint
            className={styles.inputHintTooltipBinding}
            keys={<MenuControlsInputKey binding={binding} />}
            label={bindingLabel}
          />
        </div>
      }>
      {children}
    </Tooltip>
  );
}

/**
 * The keys of one or more input actions, made of {@link MenuControlsInputKey}, followed by `label`
 * naming what they do when given.
 */
export function MenuControlsInputHint({
  className,
  keys,
  label
}: Readonly<{
  className?: string;
  keys: ReactNode;
  label?: ReactNode;
}>): ReactElement {
  return (
    <div className={classNames(styles.inputHint, className)}>
      <div className={styles.inputHintKeys}>{keys}</div>

      {label != undefined && <span>{label}</span>}
    </div>
  );
}

/**
 * The key of an input action, its modifiers included.
 * Short, it takes the game's short name where it has one, and a solid arrow for an arrow key.
 */
export function MenuControlsInputKey({
  binding,
  isShort = false
}: Readonly<{
  binding: bindings.ProxyBinding;
  isShort?: boolean;
}>): ReactElement {
  const control = binding.binding;

  const arrow = isShort && control.device == 'Keyboard' ? solidArrows.get(control.name) : undefined;

  return (
    <ControlIcons
      className={styles.inputHintKey}
      bindings={[
        arrow == undefined
          ? control
          : // A key name the game has no label for, so it falls back to the display name.
            { device: control.device, name: `hallOfFame.${control.name}`, displayName: arrow }
      ]}
      modifiers={binding.modifiers}
      {...(isShort && { shortName: shortNameFallbackToLong })}
    />
  );
}
