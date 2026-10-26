import classNames from 'classnames';
import { Button, Scrollable } from 'cs2/ui';
import { type ReactElement, useCallback, useMemo, useState } from 'react';
import type { Screenshot } from '../../common';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { useScrollController } from '../../vanilla-modules/game-ui/common/hooks/use-scroll-controller';
import {
  CityNameField,
  DescriptionField,
  SharePlaysetField,
  ShareRenderSettingsField,
  ShowcasedModField
} from '../screenshot-form';
import {
  buildScreenshotUpdate,
  canSaveEditForm,
  type EditFormValue,
  initialEditForm,
  selectPickableMods
} from './dashboard-edit-state';
import { DetailGroup } from './detail-group';
import * as formShared from '../screenshot-form/shared.module.scss';
import * as styles from './dashboard-edit-form.module.scss';

/**
 * The fields of the screenshot the server lets its creator change, in the upload form's own
 * controls, over the action row. The fields sit in two groups framed like the figures across,
 * and show their labels alone, without the upload panel's first-time hints.
 * The form starts from the screenshot and compares against it, so once a save lands it holds
 * nothing to save, and a failed one keeps the edits.
 */
export function DashboardEditForm({
  screenshot,
  isSaving
}: Readonly<{
  screenshot: Screenshot;
  isSaving: boolean;
}>): ReactElement {
  const translate = useTranslate();

  const assetMods = bindings.useDashboardAssetMods();

  const scrollController = useScrollController?.();

  const [form, setForm] = useState(() => initialEditForm(screenshot));

  // Stable, so that the memoized mod dropdown skips the re-renders a keystroke causes.
  const patchForm = useCallback(
    (patch: Partial<EditFormValue>) => setForm(previous => ({ ...previous, ...patch })),
    []
  );

  const pickableMods = useMemo(
    () => selectPickableMods(assetMods, screenshot.showcasedMod),
    [assetMods, screenshot.showcasedMod]
  );

  return (
    <div
      className={classNames(styles.form, formShared.toneDark)}
      data-dashboard-edit-form={screenshot.id}>
      <Scrollable
        {...(scrollController ? { controller: scrollController } : {})}
        className={styles.formFields}>
        <DetailGroup
          titleId='HallOfFame.UI.Dashboard.EDIT_GROUP[Presentation]'
          className={styles.formGroup}>
          <CityNameField value={form.cityName} onChange={cityName => patchForm({ cityName })} />

          <DescriptionField
            value={form.description}
            savedDescription={screenshot.description}
            scrollController={scrollController}
            hint={false}
            onChange={description => patchForm({ description })}
          />
        </DetailGroup>

        <DetailGroup
          titleId='HallOfFame.UI.Dashboard.EDIT_GROUP[Sharing]'
          className={styles.formGroup}>
          {pickableMods.length > 0 && (
            <ShowcasedModField
              assetMods={pickableMods}
              value={form}
              tone='dark'
              hint={false}
              onChange={patchForm}
            />
          )}

          <SharePlaysetField
            checked={form.shareParadoxModIds}
            hint={false}
            onChange={shareParadoxModIds => patchForm({ shareParadoxModIds })}
          />

          <ShareRenderSettingsField
            checked={form.shareRenderSettings}
            hint={false}
            onChange={shareRenderSettings => patchForm({ shareRenderSettings })}
          />
        </DetailGroup>
      </Scrollable>

      <div className={styles.formActions}>
        <Button
          variant='primary'
          className={styles.formSave}
          disabled={isSaving || !canSaveEditForm(form, screenshot)}
          onSelect={() =>
            bindings.updateDashboardScreenshot(buildScreenshotUpdate(form, screenshot))
          }>
          {translate(
            isSaving
              ? 'HallOfFame.UI.Dashboard.EDIT_ACTION[Saving]'
              : 'HallOfFame.UI.Dashboard.EDIT_ACTION[Save]'
          )}
        </Button>
      </div>
    </div>
  );
}
