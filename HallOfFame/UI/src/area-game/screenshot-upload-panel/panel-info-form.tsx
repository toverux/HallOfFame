import { Scrollable } from 'cs2/ui';
import { memo, type ReactElement, useCallback } from 'react';
import {
  DescriptionField,
  SharePlaysetField,
  ShareRenderSettingsField,
  ShowcasedModField
} from '../../components/screenshot-form';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { useScrollController } from '../../vanilla-modules/game-ui/common/hooks/use-scroll-controller';
import type { ScreenshotInfoFormValue } from './form-state';
import * as styles from './panel-info-form.module.scss';

export const ScreenshotUploadPanelContentScreenshotInfo = memo(
  ScreenshotUploadPanelContentScreenshotInfoBase
);

function ScreenshotUploadPanelContentScreenshotInfoBase({
  creatorNameIsEmpty,
  screenshotSnapshot,
  formValue,
  patchFormValue
}: Readonly<{
  creatorNameIsEmpty: boolean;
  screenshotSnapshot: bindings.JsonScreenshotSnapshot;
  formValue: ScreenshotInfoFormValue;
  patchFormValue: (state: Partial<ScreenshotInfoFormValue>) => void;
}>): ReactElement {
  const translate = useTranslate();

  const assetMods = bindings.useAssetMods();

  const uploadFormMemory = bindings.useUploadFormMemory();

  const scrollController = useScrollController?.();

  const handleShareModIdsChange = useCallback(
    (checked: boolean) => patchFormValue({ shareModIds: checked }),
    [patchFormValue]
  );

  const handleShareRenderSettingsChange = useCallback(
    (checked: boolean) => patchFormValue({ shareRenderSettings: checked }),
    [patchFormValue]
  );

  const handleDescriptionChange = useCallback(
    (description: string) => patchFormValue({ description }),
    [patchFormValue]
  );

  // noinspection HtmlRequiredAltAttribute
  return (
    <Scrollable
      {...(scrollController ? { controller: scrollController } : {})}
      className={styles.screenshotInfoScrollable}>
      {creatorNameIsEmpty && (
        <div className={styles.warning}>
          {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.CREATOR_NAME_IS_EMPTY')}
        </div>
      )}

      {!screenshotSnapshot.areSettingsTopQuality && (
        <div className={styles.warning}>
          {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.SETTINGS_NOT_TOP_QUALITY')}
        </div>
      )}

      <div className={styles.form} onMouseEnter={playHoverSound}>
        <SharePlaysetField checked={formValue.shareModIds} onChange={handleShareModIdsChange} />

        <ShareRenderSettingsField
          checked={formValue.shareRenderSettings}
          onChange={handleShareRenderSettingsChange}
        />

        {assetMods.length > 0 && (
          <ShowcasedModField assetMods={assetMods} value={formValue} onChange={patchFormValue} />
        )}

        <DescriptionField
          value={formValue.description}
          savedDescription={uploadFormMemory.description}
          scrollController={scrollController}
          onChange={handleDescriptionChange}
        />
      </div>

      <div style={{ flex: 1 }} />

      <div className={styles.notes}>
        {screenshotSnapshot.wasGlobalIlluminationDisabled && (
          <p>
            {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.GLOBAL_ILLUMINATION_DISABLED')}
          </p>
        )}
        <p>
          {translate(
            'HallOfFame.UI.Game.ScreenshotUploadPanel.UPDATE_CITY_CREATOR_NAME_ON_THE_FLY'
          )}
        </p>
        <p style={{ margin: 0 }}>
          {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.MESSAGE_MODERATED')}
        </p>
      </div>
    </Scrollable>
  );
}

function playHoverSound(): void {
  bindings.playSound('hover-item');
}
