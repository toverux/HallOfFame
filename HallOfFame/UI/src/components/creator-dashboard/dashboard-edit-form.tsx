import classNames from 'classnames';
import { Button, type ButtonSounds, Scrollable } from 'cs2/ui';
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Screenshot } from '../../common';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { useScrollController } from '../../vanilla-modules/game-ui/common/hooks/use-scroll-controller';
import { defaultButtonSounds } from '../../vanilla-modules/game-ui/common/input/button/button';
import {
  CityNameField,
  DescriptionField,
  SharePlaysetField,
  ShareRenderSettingsField,
  ShowcasedModField
} from '../screenshot-form';
import { DashboardActionsMenu } from './dashboard-actions-menu';
import {
  buildScreenshotUpdate,
  canSaveEditForm,
  type EditFormValue,
  hasEditFormChanges,
  initialEditForm,
  selectPickableMods
} from './dashboard-edit-state';
import { DetailGroup } from './detail-group';
import * as formShared from '../screenshot-form/shared.module.scss';
import * as styles from './dashboard-edit-form.module.scss';

/**
 * The fields of the screenshot the server lets its creator change, in the upload form's own
 * controls, over the action row at its end: Delete at its start, away from Save at its end and
 * the other actions' menu before it.
 * The fields sit in two groups framed like the figures across, and show their labels alone,
 * without the upload panel's first-time hints.
 * The form starts from the screenshot and compares against it, so once a save lands it holds
 * nothing to save, and a failed one keeps the edits.
 * It reports whether it holds edits, which the dashboard's exits ask before dropping.
 */
export function DashboardEditForm({
  screenshot,
  isSaving,
  isDeleting,
  onHasChangesChange
}: Readonly<{
  screenshot: Screenshot;
  isSaving: boolean;
  isDeleting: boolean;
  onHasChangesChange: (hasChanges: boolean) => void;
}>): ReactElement {
  const translate = useTranslate();

  const assetMods = bindings.useDashboardAssetMods();

  // One mutation at a time: the other waits for its answer.
  const isMutating = isSaving || isDeleting;

  const scrollController = useScrollController?.();

  const [form, setForm] = useState(() => initialEditForm(screenshot));

  // Stable, so that the memoized mod dropdown skips the re-renders a keystroke causes.
  const patchForm = useCallback(
    (patch: Partial<EditFormValue>) => setForm(previous => ({ ...previous, ...patch })),
    []
  );

  const hasChanges = hasEditFormChanges(form, screenshot);

  useEffect(() => {
    onHasChangesChange(hasChanges);
  }, [hasChanges, onHasChangesChange]);

  // An unmounted form holds nothing to drop.
  useEffect(
    () => () => {
      onHasChangesChange(false);
    },
    [onHasChangesChange]
  );

  const hasJustSaved = useHasJustSaved(isSaving, hasChanges);

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
          theme={plainButtonTheme}
          className={styles.formDelete}
          disabled={isMutating}
          sounds={deleteButtonSounds}
          onSelect={bindings.deleteDashboardScreenshot}>
          {translate(
            isDeleting
              ? 'HallOfFame.UI.Dashboard.EDIT_ACTION[Deleting]'
              : 'HallOfFame.UI.Dashboard.EDIT_ACTION[Delete]'
          )}
        </Button>

        <div className={styles.formActionsEnd}>
          <DashboardActionsMenu screenshot={screenshot} isMutating={isMutating} />

          <Button
            variant='primary'
            className={styles.formSave}
            disabled={isMutating || !canSaveEditForm(form, screenshot)}
            onSelect={() =>
              bindings.updateDashboardScreenshot(buildScreenshotUpdate(form, screenshot))
            }>
            {translate(
              isSaving
                ? 'HallOfFame.UI.Dashboard.EDIT_ACTION[Saving]'
                : hasJustSaved
                  ? 'HallOfFame.UI.Dashboard.EDIT_ACTION[Saved]'
                  : 'HallOfFame.UI.Dashboard.EDIT_ACTION[Save]'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Whether a save landed a moment ago:
 * the save ending on a form holding nothing to save, where a failed one leaves its edits.
 * A new edit ends the moment early.
 */
function useHasJustSaved(isSaving: boolean, hasChanges: boolean): boolean {
  const [hasJustSaved, setHasJustSaved] = useState(false);

  const wasSaving = useRef(isSaving);

  useEffect(() => {
    const hasLanded = wasSaving.current && !isSaving && !hasChanges;

    wasSaving.current = isSaving;

    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (hasLanded) {
      setHasJustSaved(true);

      timeout = setTimeout(() => setHasJustSaved(false), JUST_SAVED_MS);
    }

    return () => {
      clearTimeout(timeout);
      setHasJustSaved(false);
    };
  }, [isSaving, hasChanges]);

  return hasJustSaved;
}

const JUST_SAVED_MS = 2000;

// The bulldozer, as the slideshow's report plays it: both take something down.
const deleteButtonSounds: ButtonSounds = { ...defaultButtonSounds, select: 'bulldoze' };

const plainButtonTheme = { button: '' };
