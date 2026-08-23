import type { FocusKey } from 'cs2/ui';
import {
  type ChangeEventHandler,
  type CSSProperties,
  type FocusEventHandler,
  forwardRef,
  type ForwardRefExoticComponent,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type RefAttributes
} from 'react';
import { getModuleExport } from '../../../../../utils';

/**
 * The element the component renders, which {@link TextInputProps.multiline} decides.
 */
export type TextInputElement = HTMLInputElement | HTMLTextAreaElement;

/**
 * Inferred from `game-ui/common/input/text/text-input.tsx`.
 */
export interface TextInputProps {
  /**
   * The field registers a focus node of its own, so a parent that is a leaf of the focus tree
   * rejects it: pass `FOCUS_DISABLED` to place the field inside one.
   *
   * @default FOCUS_AUTO
   */
  readonly focusKey?: FocusKey;

  /**
   * @default 'TextInput'
   */
  readonly debugName?: string;

  /**
   * @default 'text'
   */
  readonly type?: 'text' | 'password';

  /**
   * @default ''
   */
  readonly value?: string;

  /**
   * Selects the whole value when the field takes the focus, rather than placing the caret at the
   * end.
   *
   * @default true
   */
  readonly selectAllOnFocus?: boolean;

  /**
   * Shown in place of the value while the field is blurred and empty, since Cohtml renders no
   * native placeholder. A focused field shows its value, empty or not.
   *
   * @default ''
   */
  readonly placeholder?: string;

  /**
   * Title of the virtual keyboard console and handheld players type on.
   *
   * @default ''
   */
  readonly vkTitle?: string;

  /**
   * Description of the virtual keyboard console and handheld players type on.
   *
   * @default ''
   */
  readonly vkDescription?: string;

  readonly disabled?: boolean;

  /**
   * Marks the controller hint active while the field is not focused.
   * It shows a hint only alongside {@link showHint}, which is what renders one.
   */
  readonly forceHint?: boolean;

  /**
   * Renders a controller hint element next to the field.
   */
  readonly showHint?: boolean;

  readonly className?: string;

  readonly style?: CSSProperties;

  readonly maxLength?: number;

  /**
   * Renders a `<textarea>` instead of an `<input>`, of that many rows when given a number.
   * Any defined value switches the element, `false` included.
   */
  readonly multiline?: boolean | number;

  readonly onFocus?: FocusEventHandler<TextInputElement>;

  readonly onBlur?: FocusEventHandler<TextInputElement>;

  readonly onKeyDown?: KeyboardEventHandler<TextInputElement>;

  readonly onChange?: ChangeEventHandler<TextInputElement>;

  readonly onMouseUp?: MouseEventHandler<TextInputElement>;

  readonly onDoubleClick?: MouseEventHandler<TextInputElement>;

  /**
   * Called when the game's Select action focuses the field, which is how a controller reaches it.
   */
  readonly onSelect?: () => void;

  /**
   * Called when the game's Back or Close action leaves the field, which the component registers for
   * as long as the field holds the focus.
   */
  readonly onBack?: () => void;
}

type TextInputComponent = ForwardRefExoticComponent<
  TextInputProps & RefAttributes<TextInputElement>
>;

export const TextInput = getModuleExport<TextInputComponent>(
  'game-ui/common/input/text/text-input.tsx',
  'TextInput',
  // The vanilla component is a `forwardRef`, an object rather than a function.
  (value): value is TextInputComponent =>
    typeof value == 'object' && value != null && 'render' in value,
  // oxlint-disable-next-line react/jsx-no-literals
  forwardRef(() => <>Error</>)
);
