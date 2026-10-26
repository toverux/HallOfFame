import classNames from 'classnames';
import type { ReactElement, ReactNode } from 'react';
import { getClassesModule } from '../../utils';
import * as bindings from '../../utils/bindings';
import {
  Checkbox,
  type CheckboxTheme
} from '../../vanilla-modules/game-ui/common/input/toggle/checkbox/checkbox';
import * as styles from './checkbox-field.module.scss';

const coCheckboxTheme = getClassesModule(
  'game-ui/common/input/toggle/checkbox/checkbox.module.scss',
  ['toggle', 'checkmark']
);

const checkboxTheme: CheckboxTheme = {
  ...coCheckboxTheme,
  toggle: classNames(coCheckboxTheme.toggle, styles.checkboxToggle),
  checkmark: classNames(coCheckboxTheme.checkmark, styles.checkboxCheckmark)
};

/**
 * A labelled checkbox whose whole box toggles it,
 * with an optional hint under its label, and an optional control under both that belongs to
 * the choice, like the showcased mod's dropdown.
 */
export function CheckboxField({
  checked,
  label,
  description,
  onChange,
  children
}: Readonly<{
  checked: boolean;
  label: ReactNode;
  description?: ReactNode | undefined;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}>): ReactElement {
  const labelElement = (
    <label>
      {label}
      {description && (
        <>
          <br />
          <small>{description}</small>
        </>
      )}
    </label>
  );

  return (
    <div
      className={classNames(styles.field, { [styles.fieldChecked]: checked })}
      onMouseEnter={bindings.playHoverSound}
      onClick={() => {
        onChange(!checked);
        bindings.playSound('select-toggle');
      }}>
      <Checkbox theme={checkboxTheme} checked={checked} onChange={onChange} />

      {children ? (
        <div className={styles.fieldBody}>
          {labelElement}
          {children}
        </div>
      ) : (
        labelElement
      )}
    </div>
  );
}
