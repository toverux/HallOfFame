import type { ReactElement } from 'react';
import { useTranslate } from '../../utils';
import { CheckboxField } from './checkbox-field';

export function SharePlaysetField({
  checked,
  hint = true,
  onChange
}: Readonly<{
  checked: boolean;
  hint?: boolean;
  onChange: (checked: boolean) => void;
}>): ReactElement {
  const translate = useTranslate();

  return (
    <CheckboxField
      checked={checked}
      label={translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHARE_PLAYSET_LABEL')}
      description={
        hint && translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHARE_PLAYSET_DESCRIPTION')
      }
      onChange={onChange}
    />
  );
}

export function ShareRenderSettingsField({
  checked,
  hint = true,
  onChange
}: Readonly<{
  checked: boolean;
  hint?: boolean;
  onChange: (checked: boolean) => void;
}>): ReactElement {
  const translate = useTranslate();

  return (
    <CheckboxField
      checked={checked}
      label={translate(
        'HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHARE_PHOTO_MODE_SETTINGS_LABEL'
      )}
      description={
        hint &&
        translate(
          'HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHARE_PHOTO_MODE_SETTINGS_DESCRIPTION'
        )
      }
      onChange={onChange}
    />
  );
}
