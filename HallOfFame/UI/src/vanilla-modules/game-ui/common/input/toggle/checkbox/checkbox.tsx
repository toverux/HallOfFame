import type { FocusKey, UISound } from 'cs2/ui';
import type { CSSProperties, FC, MouseEventHandler } from 'react';
import { getModuleExport } from '../../../../../../utils';

/**
 * Inferred from `game-ui/common/input/toggle/toggle.tsx`.
 */
export interface ToggleProps {
  readonly focusKey?: FocusKey;
  /**
   * @default 'Toggle'
   */
  readonly debugName?: string;
  readonly checked?: boolean | undefined;
  /**
   * @default false
   */
  readonly disabled?: boolean | undefined;
  readonly style?: CSSProperties;
  /**
   * @default 'select-toggle'
   */
  readonly toggleSound?: UISound;
  readonly className?: string;
  readonly onChange?: (value: boolean) => void;
  readonly onMouseOver?: MouseEventHandler<HTMLElement>;
  readonly onMouseLeave?: MouseEventHandler<HTMLElement>;
}

/**
 * Inferred from `game-ui/common/input/toggle/checkbox/checkbox.tsx`.
 */
export interface CheckboxProps extends ToggleProps {
  readonly theme?: Partial<CheckboxTheme>;
}

/**
 * Inferred from `game-ui/common/input/toggle/checkbox/checkbox.module.scss`.
 */
export interface CheckboxTheme {
  readonly toggle: string;
  readonly checkmark: string;
}

export const Checkbox = getModuleExport<FC<CheckboxProps>>(
  'game-ui/common/input/toggle/checkbox/checkbox.tsx',
  'Checkbox',
  (value): value is FC<CheckboxProps> => typeof value == 'function',
  // oxlint-disable-next-line react/jsx-no-literals
  () => <>Error</>
);
