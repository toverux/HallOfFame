import type { ReactElement } from 'react';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { TextInput } from '../../vanilla-modules/game-ui/common/input/text/text-input';
import * as styles from './city-name-field.module.scss';

/**
 * The screenshot's city name, a single-line input.
 * The server checks it, and a refused save says why.
 */
export function CityNameField({
  value,
  onChange
}: Readonly<{
  value: string;
  onChange: (cityName: string) => void;
}>): ReactElement {
  const translate = useTranslate();

  // Also the heading of the virtual keyboard console and handheld players type on.
  const label = translate('HallOfFame.UI.Dashboard.EDIT_FIELD[City Name]') ?? '';

  return (
    <div className={styles.field} onMouseEnter={bindings.playHoverSound}>
      <label>{label}</label>

      <div className={styles.inputWrapper}>
        <TextInput
          value={value}
          // A name is corrected rather than replaced, so the caret belongs at the end.
          selectAllOnFocus={false}
          vkTitle={label}
          onChange={event => onChange(event.target.value)}
        />
      </div>
    </div>
  );
}
