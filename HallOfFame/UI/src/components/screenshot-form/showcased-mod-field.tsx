import { type ReactElement, useCallback } from 'react';
import { useTranslate } from '../../utils';
import type * as bindings from '../../utils/bindings';
import { AssetModDropdown } from './asset-mod-dropdown';
import { CheckboxField } from './checkbox-field';

export interface ShowcasedModValue {
  readonly isShowcasingAsset: boolean;
  readonly showcasedMod: bindings.JsonMod | undefined;
}

/**
 * Opts into showcasing an asset mod and picks it.
 * Unchecking drops the pick, so a checked field without one is the invalid state it flags.
 */
export function ShowcasedModField({
  assetMods,
  value,
  onChange
}: Readonly<{
  assetMods: readonly bindings.JsonMod[];
  value: ShowcasedModValue;
  onChange: (value: ShowcasedModValue) => void;
}>): ReactElement {
  const translate = useTranslate();

  // Stable, so that the memoized dropdown skips the re-renders a description keystroke causes.
  const selectShowcasedMod = useCallback(
    (selectedMod: bindings.JsonMod) =>
      onChange({ isShowcasingAsset: true, showcasedMod: selectedMod }),
    [onChange]
  );

  return (
    <CheckboxField
      checked={value.isShowcasingAsset}
      label={translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_LABEL')}
      description={translate(
        'HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_DESCRIPTION'
      )}
      onChange={checked =>
        onChange({
          isShowcasingAsset: checked,
          showcasedMod: checked ? value.showcasedMod : undefined
        })
      }>
      <AssetModDropdown
        assetMods={assetMods}
        showcasedMod={value.showcasedMod}
        isInvalid={value.isShowcasingAsset && !value.showcasedMod}
        onSelect={selectShowcasedMod}
      />
    </CheckboxField>
  );
}
