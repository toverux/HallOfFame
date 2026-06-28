import classNames from 'classnames';
import { FocusSymbol } from 'cs2/input';
import { useLocalization } from 'cs2/l10n';
import {
  Button,
  Dropdown,
  DropdownItem,
  type DropdownTheme,
  DropdownToggle,
  Scrollable
} from 'cs2/ui';
import { memo, type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as bindings from '../../bindings';
import { getClassesModule, playSound } from '../../utils';
import { useScrollController } from '../../vanilla-modules/game-ui/common/hooks/use-scroll-controller';
import {
  Checkbox,
  type CheckboxTheme
} from '../../vanilla-modules/game-ui/common/input/toggle/checkbox/checkbox';
import type { ScreenshotInfoFormValue } from './form-state';
import * as styles from './panel-info-form.module.scss';
import * as shared from './shared.module.scss';

const coCheckboxTheme = getClassesModule(
  'game-ui/common/input/toggle/checkbox/checkbox.module.scss',
  ['toggle', 'checkmark']
);

const coDropdownTheme = getClassesModule(
  'game-ui/common/input/dropdown/themes/default.module.scss',
  [
    'dropdownItem',
    'dropdownMenu',
    'dropdownPopup',
    'dropdownToggle',
    'indicator',
    'label',
    'scrollable'
  ]
);

const checkboxTheme: CheckboxTheme = {
  ...coCheckboxTheme,
  toggle: classNames(coCheckboxTheme.toggle, styles.checkboxToggle),
  checkmark: classNames(coCheckboxTheme.checkmark, styles.checkboxCheckmark)
};

const dropdownTheme: DropdownTheme = {
  ...coDropdownTheme,
  dropdownToggle: classNames(coDropdownTheme.dropdownToggle, styles.dropdownToggle),
  dropdownPopup: classNames(
    coDropdownTheme.dropdownPopup,
    styles.dropdownPopup,
    shared.scrollableTrackCustomization
  ),
  dropdownItem: classNames(coDropdownTheme.dropdownItem, styles.dropdownItem)
};

export const ScreenshotUploadPanelContentScreenshotInfo = memo(
  ScreenshotUploadPanelContentScreenshotInfoBase
);

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: form template makes it long, but it's simple
function ScreenshotUploadPanelContentScreenshotInfoBase({
  settings,
  creatorNameIsEmpty,
  screenshotSnapshot,
  formValue,
  patchFormValue
}: Readonly<{
  settings: bindings.ModSettings;
  creatorNameIsEmpty: boolean;
  screenshotSnapshot: bindings.JsonScreenshotSnapshot;
  formValue: ScreenshotInfoFormValue;
  patchFormValue: (state: Partial<ScreenshotInfoFormValue>) => void;
}>): ReactElement {
  const { translate } = useLocalization();

  const assetMods = bindings.useAssetMods();

  const scrollController = useScrollController?.();

  const playHoverSound = useCallback(() => playSound('hover-item'), []);

  const selectShowcasedMod = useCallback(
    (selectedMod: bindings.JsonMod) =>
      patchFormValue({ isShowcasingAsset: true, showcasedMod: selectedMod }),
    [patchFormValue]
  );

  const handleShareModIdsChange = useCallback(
    (checked: boolean) => patchFormValue({ shareModIds: checked }),
    [patchFormValue]
  );

  const handleShareRenderSettingsChange = useCallback(
    (checked: boolean) => patchFormValue({ shareRenderSettings: checked }),
    [patchFormValue]
  );

  const handleShowcasingAssetChange = useCallback(
    (checked: boolean) =>
      patchFormValue({
        isShowcasingAsset: checked,
        showcasedMod: checked ? formValue.showcasedMod : undefined
      }),
    [patchFormValue, formValue.showcasedMod]
  );

  const restoreSavedDescription = useCallback(
    () => patchFormValue({ description: settings.savedScreenshotDescription }),
    [patchFormValue, settings.savedScreenshotDescription]
  );

  const clearDescription = useCallback(() => patchFormValue({ description: '' }), [patchFormValue]);

  const textareaContainerRef = useRef<HTMLDivElement>(null);

  const [textareaFocused, setTextareaFocused] = useState(false);

  // When the textarea is focused, scroll it fully into view.
  useEffect(() => {
    if (!(textareaFocused && textareaContainerRef.current)) {
      return;
    }

    // The textarea expands when focused; wait for the textarea row count to be set and rendered.
    setTimeout(() => {
      scrollController?.scrollIntoView(
        // Strange cast because of incorrect things in cs2/ui types.
        textareaContainerRef.current as unknown as import('cs2/ui').Element
      );
    }, 100 /* for some reason the textarea takes ages to resize */);
  }, [textareaContainerRef, scrollController, textareaFocused]);

  const assetModsDropdownItems = useMemo(
    () =>
      assetMods.map(mod => (
        <DropdownItem
          key={mod.id}
          value={mod}
          focusKey={new FocusSymbol(`mod-${mod.id}`)}
          onChange={selectShowcasedMod}>
          <div
            className={styles.dropdownItemImage}
            style={{ backgroundImage: `url(${mod.thumbnailPath})` }}
          />
          <div className={styles.dropdownItemText}>{mod.displayName}</div>
        </DropdownItem>
      )),
    [assetMods, selectShowcasedMod]
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
        <div
          className={classNames(styles.formField, styles.formFieldInline, {
            [styles.formFieldChecked]: formValue.shareModIds
          })}
          onMouseEnter={playHoverSound}
          // biome-ignore lint/performance/noJsxPropsBind: host element does not bail out on prop identity
          onClick={() => (
            patchFormValue({ shareModIds: !formValue.shareModIds }), playSound('select-toggle')
          )}>
          <Checkbox
            theme={checkboxTheme}
            checked={formValue.shareModIds}
            onChange={handleShareModIdsChange}
          />

          <label>
            {`${translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHARE_PLAYSET_LABEL')} β`}
            <br />
            <small>
              {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHARE_PLAYSET_DESCRIPTION')}
            </small>
          </label>
        </div>

        <div
          className={classNames(styles.formField, styles.formFieldInline, {
            [styles.formFieldChecked]: formValue.shareRenderSettings
          })}
          onMouseEnter={playHoverSound}
          // biome-ignore lint/performance/noJsxPropsBind: host element does not bail out on prop identity
          onClick={() => (
            patchFormValue({ shareRenderSettings: !formValue.shareRenderSettings }),
            playSound('select-toggle')
          )}>
          <Checkbox
            theme={checkboxTheme}
            checked={formValue.shareRenderSettings}
            onChange={handleShareRenderSettingsChange}
          />

          <label>
            {`${translate(
              'HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHARE_PHOTO_MODE_SETTINGS_LABEL'
            )} β`}
            <br />
            <small>
              {translate(
                'HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHARE_PHOTO_MODE_SETTINGS_DESCRIPTION'
              )}
            </small>
          </label>
        </div>

        {assetMods.length > 0 && (
          <div
            className={classNames(styles.formField, styles.formFieldInline, {
              [styles.formFieldChecked]: formValue.isShowcasingAsset,
              [styles.formFieldInvalid]: formValue.isShowcasingAsset && !formValue.showcasedMod
            })}
            onMouseEnter={playHoverSound}
            // biome-ignore lint/performance/noJsxPropsBind: host element does not bail out on prop identity
            onClick={() => (
              patchFormValue({
                isShowcasingAsset: !formValue.isShowcasingAsset,
                showcasedMod: formValue.isShowcasingAsset ? undefined : formValue.showcasedMod
              }),
              playSound('select-toggle')
            )}>
            <Checkbox
              theme={checkboxTheme}
              checked={formValue.isShowcasingAsset}
              onChange={handleShowcasingAssetChange}
            />

            <div className={styles.formFieldBlock}>
              <label>
                {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_LABEL')}
                <br />
                <small>
                  {translate(
                    'HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_DESCRIPTION'
                  )}
                </small>
              </label>

              <Dropdown theme={dropdownTheme} content={assetModsDropdownItems}>
                <DropdownToggle sounds={{ hover: null }}>
                  {formValue.showcasedMod ? (
                    <div
                      className={classNames(
                        dropdownTheme.dropdownItem,
                        styles.dropdownPreviewItem
                      )}>
                      <div
                        className={styles.dropdownItemImage}
                        style={{ backgroundImage: `url(${formValue.showcasedMod.thumbnailPath})` }}
                      />
                      <div className={styles.dropdownItemText}>
                        {formValue.showcasedMod.displayName}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={classNames(
                        dropdownTheme.dropdownItem,
                        styles.dropdownPreviewItem
                      )}>
                      {translate(
                        'HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_SELECT_ASSET'
                      )}
                    </div>
                  )}
                </DropdownToggle>
              </Dropdown>
            </div>
          </div>
        )}

        <div
          ref={textareaContainerRef}
          className={classNames(styles.formField, styles.formFieldBlock)}
          style={{ margin: 0 }}
          onMouseEnter={playHoverSound}>
          <label>
            {`${translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_DESCRIPTION_LABEL')} β`}
            <br />
            <small>
              {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_DESCRIPTION_DESCRIPTION')}
            </small>
          </label>

          <div className={styles.textareaWrapper}>
            <textarea
              rows={textareaFocused || formValue.description.length > 0 ? 5 : 1}
              maxLength={4000}
              value={formValue.description}
              // biome-ignore lint/performance/noJsxPropsBind: host element does not bail out on prop identity
              onFocus={() => setTextareaFocused(true)}
              // biome-ignore lint/performance/noJsxPropsBind: host element does not bail out on prop identity
              onBlur={() => setTextareaFocused(false)}
              // biome-ignore lint/performance/noJsxPropsBind: host element does not bail out on prop identity
              onChange={event => patchFormValue({ description: event.target.value })}
            />

            {(textareaFocused || formValue.description.length > 0) && (
              <div className={styles.textareaControls}>
                {formValue.description.length == 0 && settings.savedScreenshotDescription && (
                  <Button
                    variant='default'
                    className={styles.textareaControlsButton}
                    // biome-ignore lint/performance/noJsxPropsBind: trivial preventDefault handler, not worth extracting
                    onMouseDown={event => event.preventDefault()}
                    onClick={restoreSavedDescription}>
                    {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_DESCRIPTION_RESTORE')}
                  </Button>
                )}

                <Button
                  variant='default'
                  className={styles.textareaControlsButton}
                  // use visibility to avoid a small layout shift when the button appears.
                  style={{ visibility: formValue.description.length > 0 ? 'visible' : 'hidden' }}
                  onClick={clearDescription}>
                  {translate('Editor.CLEAR', 'Clear')}
                </Button>

                <div style={{ flex: 1 }} />

                {/** biome-ignore lint/style/noJsxLiterals: no need to translate this */}
                <span>{formValue.description.length}&thinsp;/&thinsp;4000</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div className={styles.content}>
        <p>
          {`β ${translate('HallOfFame.UI.Game.ScreenshotUploadPanel.PARTIALLY_IMPLEMENTED_FEATURES')}`}
        </p>
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
