import { ControlIcons } from 'cs2/input';
import type { ReactElement, ReactNode } from 'react';
import { Tooltip, type TooltipProps } from '../../components/tooltip';
import type * as bindings from '../../utils/bindings';
import * as styles from './input-hint-tooltip.module.scss';

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

          <div className={styles.inputHintTooltipBinding}>
            <ControlIcons
              className={styles.inputHintTooltipBindingIcons}
              bindings={[binding.binding]}
              modifiers={binding.modifiers}
            />

            {bindingLabel != undefined && (
              <span className={styles.inputHintTooltipBindingLabel}>{bindingLabel}</span>
            )}
          </div>
        </div>
      }>
      {children}
    </Tooltip>
  );
}
