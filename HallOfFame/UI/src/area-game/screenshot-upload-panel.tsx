import classNames from 'classnames';
import { bindValue, trigger, useValue } from 'cs2/api';
import { FocusSymbol } from 'cs2/input';
import { type Localization, LocalizedNumber, LocalizedString, useLocalization } from 'cs2/l10n';
import {
  Button,
  Dropdown,
  DropdownItem,
  type DropdownTheme,
  DropdownToggle,
  Icon,
  Scrollable,
  Tooltip
} from 'cs2/ui';
import {
  type CSSProperties,
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useSetState } from 'react-use';
import cloudArrowUpSolidSrc from '../icons/fontawesome/cloud-arrow-up-solid.svg';
import populationSrc from '../icons/paradox/population.svg';
import trophySrc from '../icons/paradox/trophy.svg';
import {
  createSingletonHook,
  type DraggableProps,
  getClassesModule,
  type ModSettings,
  playSound,
  useDraggable,
  useModSettings
} from '../utils';
import { useScrollController } from '../vanilla-modules/game-ui/common/hooks/use-scroll-controller';
import {
  Checkbox,
  type CheckboxTheme
} from '../vanilla-modules/game-ui/common/input/toggle/checkbox/checkbox';
import { DescriptionTooltip } from '../vanilla-modules/game-ui/common/tooltip/description-tooltip/description-tooltip';
import {
  LoadingProgress,
  loadingProgressVanillaProps
} from '../vanilla-modules/game-ui/overlay/logo-screen/loading/loading-progress';
import * as styles from './screenshot-upload-panel.module.scss';

/** From `Colossal.PSI.Common.Mod` */
interface JsonMod {
  readonly id: number;
  readonly displayName: string;
  readonly thumbnailPath: string;
}

/** From `HallOfFame.Systems.CaptureUISystem.ScreenshotSnapshot` */
interface JsonScreenshotSnapshot {
  readonly achievedMilestone: number;
  readonly population: number;
  readonly previewImageUri: string;
  readonly imageUri: string;
  readonly imageFileSize: number;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly wasGlobalIlluminationDisabled: boolean;
  readonly areSettingsTopQuality: boolean;
}

/** From `HallOfFame.Systems.CaptureUISystem.UploadProgress` */
interface JsonUploadProgress {
  readonly isComplete: boolean;
  readonly globalProgress: number;
  readonly uploadProgress: number;
  readonly processingProgress: number;
}

interface ScreenshotInfoFormValue {
  shareModIds: boolean;
  shareRenderSettings: boolean;
  isShowcasingAsset: boolean;
  showcasedMod: JsonMod | undefined;
  description: string;
}

const coFixedRatioImageStyles = getClassesModule(
  'game-ui/common/image/fixed-ratio-image.module.scss',
  ['fixedRatioImage', 'image', 'ratio']
);

const coLoadingStyles = getClassesModule(
  'game-ui/overlay/logo-screen/loading/loading.module.scss',
  ['progress']
);

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
  toggle: classNames(coCheckboxTheme.toggle, styles.screenshotUploadPanelFormCheckboxToggle),
  checkmark: classNames(
    coCheckboxTheme.checkmark,
    styles.screenshotUploadPanelFormCheckboxToggleCheckmark
  )
};

const dropdownTheme: DropdownTheme = {
  ...coDropdownTheme,
  dropdownToggle: classNames(
    coDropdownTheme.dropdownToggle,
    styles.screenshotUploadPanelFormDropdownToggle
  ),
  dropdownPopup: classNames(
    coDropdownTheme.dropdownPopup,
    styles.screenshotUploadPanelFormDropdownPopup,
    styles.scrollableTrackCustomization
  ),
  dropdownItem: classNames(
    coDropdownTheme.dropdownItem,
    styles.screenshotUploadPanelFormDropdownToggleItem
  )
};

const assetMods$ = bindValue<JsonMod[]>('hallOfFame.capture', 'assetMods');

const cityName$ = bindValue<string>('hallOfFame.capture', 'cityName');

const screenshotSnapshot$ = bindValue<JsonScreenshotSnapshot | null>(
  'hallOfFame.capture',
  'screenshotSnapshot',
  null
);

const uploadProgress$ = bindValue<JsonUploadProgress | null>(
  'hallOfFame.capture',
  'uploadProgress',
  null
);

const useUploadSuccessImageUri = createSingletonHook<string | undefined>(undefined);

/**
 * Component that shows up when the user takes a HoF screenshot.
 */
export function ScreenshotUploadPanel(): ReactElement {
  const settings = useModSettings();

  const panelRef = useRef<HTMLDivElement>(null);
  const draggable = useDraggable(panelRef);

  const screenshotSnapshot = useValue(screenshotSnapshot$);
  const uploadProgress = useValue(uploadProgress$);

  const originalFormState: ScreenshotInfoFormValue = {
    shareModIds: settings.savedShareModIdsPreference,
    shareRenderSettings: settings.savedShareRenderSettingsPreference,
    isShowcasingAsset: false,
    showcasedMod: undefined,
    // A button under the textarea allows the user to restore from `settings.savedDescription`
    description: ''
  };

  const [formValue, patchFormValue] = useSetState<ScreenshotInfoFormValue>(originalFormState);

  // Reset the form whenever a new screenshot is captured.
  useEffect(() => {
    if (screenshotSnapshot) {
      patchFormValue(originalFormState);
    }
  }, [screenshotSnapshot]);

  // Show the panel when there is a screenshot to upload.
  if (!screenshotSnapshot) {
    // biome-ignore lint/complexity/noUselessFragments: we need to return a ReactElement.
    return <></>;
  }

  const creatorNameIsEmpty = !settings.creatorName.trim();

  return (
    <div className={styles.screenshotUploadPanelContainer}>
      <div
        ref={panelRef}
        className={classNames(styles.screenshotUploadPanel, styles.scrollableTrackCustomization)}>
        <ScreenshotUploadPanelHeader
          screenshotSnapshot={screenshotSnapshot}
          draggable={draggable}
        />

        <div className={styles.screenshotUploadPanelPanes}>
          {uploadProgress && <ScreenshotUploadProgress uploadProgress={uploadProgress} />}

          <div className={styles.screenshotUploadPanelPanesImage}>
            <ScreenshotUploadPanelImage
              screenshotSnapshot={screenshotSnapshot}
              uploadProgress={uploadProgress}
            />

            <ScreenshotUploadPanelContentCityInfo
              settings={settings}
              screenshotSnapshot={screenshotSnapshot}
              creatorNameIsEmpty={creatorNameIsEmpty}
            />
          </div>

          <div className={styles.screenshotUploadPanelPanesInfo}>
            <ScreenshotUploadPanelContentScreenshotInfo
              settings={settings}
              creatorNameIsEmpty={creatorNameIsEmpty}
              screenshotSnapshot={screenshotSnapshot}
              formValue={formValue}
              patchFormValue={patchFormValue}
            />
          </div>
        </div>

        <ScreenshotUploadPanelFooter
          creatorNameIsEmpty={creatorNameIsEmpty}
          uploadProgress={uploadProgress}
          draggable={draggable}
          formValue={formValue}
        />
      </div>
    </div>
  );
}

function ScreenshotUploadPanelHeader({
  screenshotSnapshot,
  draggable
}: Readonly<{
  screenshotSnapshot: JsonScreenshotSnapshot;
  draggable: DraggableProps;
}>): ReactElement {
  const { translate } = useLocalization();

  // Change the congratulation message every time a screenshot is taken.
  // Congratulation messages are stored in one string, separated by newlines.
  // useMemo() with imageUri is used to change the message when the state type and image URI
  // actually change.
  const congratulation = useMemo(
    () => getCongratulation(translate),
    [translate, screenshotSnapshot.imageUri]
  );

  return (
    <div className={styles.screenshotUploadPanelHeader} {...draggable}>
      {congratulation}

      <Button
        variant='round'
        className={styles.screenshotUploadPanelHeaderClose}
        onSelect={discardScreenshot}
        selectSound='close-menu'>
        <Icon src='Media/Glyphs/Close.svg' />
      </Button>
    </div>
  );
}

function ScreenshotUploadProgress({
  uploadProgress
}: Readonly<{ uploadProgress: JsonUploadProgress }>): ReactElement {
  const { translate } = useLocalization();

  const [successImageUri, setSuccessImageUri] = useUploadSuccessImageUri();

  // This useEffect is used to display the success image after the upload is complete, but only
  // after some time so the progress circles have finished animating.
  useEffect(() => {
    // Normal/in progress state, hide the success image.
    if (!uploadProgress?.isComplete) {
      setSuccessImageUri(undefined);
    }
    // Upload is complete, and the success image is not shown yet, display it after the progress
    // animation is done.
    else if (uploadProgress.isComplete && !successImageUri) {
      setTimeout(() => {
        setSuccessImageUri(getRandomUploadSuccessImage());
      }, 1500 /* This is roughly the takes it takes for the animation */);
    }
  }, [uploadProgress, successImageUri]);

  // noinspection HtmlRequiredAltAttribute
  return (
    <div className={styles.screenshotUploadPanelUploadProgress}>
      <div
        className={classNames(styles.screenshotUploadPanelUploadProgressContent, {
          [styles.screenshotUploadPanelUploadProgressContentUploadSuccess]: successImageUri != null
        })}>
        {successImageUri ? (
          <img
            src={successImageUri}
            width={loadingProgressVanillaProps.size}
            height={loadingProgressVanillaProps.size}
            // This class, which is applied to <LoadingProgress /> by the game, can be reused as-is
            // for the image.
            className={coLoadingStyles.progress}
          />
        ) : (
          <LoadingProgress
            {...loadingProgressVanillaProps}
            progress={[
              uploadProgress.globalProgress,
              uploadProgress.processingProgress,
              uploadProgress.uploadProgress
            ]}
          />
        )}

        <div className={styles.screenshotUploadPanelUploadProgressContentHint}>
          {getUploadProgressHintText(translate, uploadProgress)}
        </div>
      </div>
    </div>
  );
}

function ScreenshotUploadPanelImage({
  screenshotSnapshot,
  uploadProgress
}: Readonly<{
  screenshotSnapshot: JsonScreenshotSnapshot;
  uploadProgress: JsonUploadProgress | null;
}>): ReactElement {
  const { translate } = useLocalization();

  const ratioPreviewInfo = useMemo(
    () => screenshotSnapshot && getRatioPreviewInfo(screenshotSnapshot),
    [screenshotSnapshot]
  );

  // noinspection HtmlRequiredAltAttribute
  return (
    <div
      className={classNames(
        styles.screenshotUploadPanelImage,
        coFixedRatioImageStyles.fixedRatioImage
      )}
      style={
        {
          '--w': screenshotSnapshot.imageWidth,
          '--h': screenshotSnapshot.imageHeight
        } as CSSProperties
      }>
      {/* This div sets the size of its parent and therefore the size of the image. */}
      <div className={coFixedRatioImageStyles.ratio} />

      <img className={coFixedRatioImageStyles.image} src={screenshotSnapshot.previewImageUri} />

      {ratioPreviewInfo.type != 'equal' && (
        <DescriptionTooltip
          direction='down'
          title={translate('HallOfFame.UI.Game.ScreenshotUploadPanel.ASPECT_RATIO_TOOLTIP_TITLE')}
          description={translate(
            'HallOfFame.UI.Game.ScreenshotUploadPanel.ASPECT_RATIO_TOOLTIP_DESCRIPTION'
          )}>
          <div
            className={classNames(styles.screenshotUploadPanelImageRatioPreview, {
              [styles.screenshotUploadPanelImageHidden]: uploadProgress != null
            })}
            style={ratioPreviewInfo.style}>
            16:9
          </div>
        </DescriptionTooltip>
      )}

      <Tooltip tooltip={translate('HallOfFame.UI.Game.ScreenshotUploadPanel.MAXIMIZE_TOOLTIP')}>
        <Button
          variant='round'
          selectSound='open-panel'
          onSelect={() => showFullscreenImage(screenshotSnapshot.imageUri)}
          className={classNames(styles.screenshotUploadPanelImageMagnifyButton, {
            [styles.screenshotUploadPanelImageHidden]: uploadProgress != null
          })}>
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'>
            {/* Font Awesome Free 6.6.0 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc. */}
            <path d='M32 32C14.3 32 0 46.3 0 64l0 96c0 17.7 14.3 32 32 32s32-14.3 32-32l0-64 64 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 32zM64 352c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 96c0 17.7 14.3 32 32 32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0 0-64zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32l64 0 0 64c0 17.7 14.3 32 32 32s32-14.3 32-32l0-96c0-17.7-14.3-32-32-32l-96 0zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 64-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c17.7 0 32-14.3 32-32l0-96z' />
          </svg>
        </Button>
      </Tooltip>
    </div>
  );
}

function ScreenshotUploadPanelContentCityInfo({
  settings,
  screenshotSnapshot,
  creatorNameIsEmpty
}: Readonly<{
  settings: ModSettings;
  screenshotSnapshot: JsonScreenshotSnapshot;
  creatorNameIsEmpty: boolean;
}>): ReactElement {
  const { translate } = useLocalization();

  const cityName =
    useValue(cityName$) ||
    // biome-ignore lint/style/noNonNullAssertion: translation controlled by us.
    translate('HallOfFame.Common.DEFAULT_CITY_NAME')!;

  // noinspection HtmlRequiredAltAttribute
  return (
    <div
      className={classNames(
        styles.screenshotUploadPanelContent,
        styles.screenshotUploadPanelCityInfo
      )}>
      <span className={styles.screenshotUploadPanelCityInfoName}>
        <strong>{cityName}</strong>
        {!creatorNameIsEmpty && (
          <LocalizedString
            id='HallOfFame.Common.CITY_BY'
            // biome-ignore lint/style/useNamingConvention: i18n convention
            args={{ CREATOR_NAME: settings.creatorName }}
          />
        )}
      </span>

      <div style={{ flex: 1 }} />

      <span>
        <img src={trophySrc} />
        {translate(`Progression.MILESTONE_NAME:${screenshotSnapshot.achievedMilestone}`)}
      </span>

      <span>
        <img src={populationSrc} />
        <LocalizedNumber value={screenshotSnapshot.population} />
      </span>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: form template makes it long, but it's simple
function ScreenshotUploadPanelContentScreenshotInfo({
  settings,
  creatorNameIsEmpty,
  screenshotSnapshot,
  formValue,
  patchFormValue
}: Readonly<{
  settings: ModSettings;
  creatorNameIsEmpty: boolean;
  screenshotSnapshot: JsonScreenshotSnapshot;
  formValue: ScreenshotInfoFormValue;
  patchFormValue: (state: Partial<ScreenshotInfoFormValue>) => void;
}>): ReactElement {
  const { translate } = useLocalization();

  const assetMods = useValue(assetMods$);

  const scrollController = useScrollController?.();

  const playHoverSound = useCallback(() => playSound('hover-item'), []);

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
          onChange={selectedMod =>
            patchFormValue({ isShowcasingAsset: true, showcasedMod: selectedMod })
          }>
          <div
            className={styles.screenshotUploadPanelFormDropdownToggleItemImage}
            style={{ backgroundImage: `url(${mod.thumbnailPath})` }}
          />
          {mod.displayName}
        </DropdownItem>
      )),
    [assetMods, patchFormValue]
  );

  // noinspection HtmlRequiredAltAttribute
  return (
    <Scrollable
      {...(scrollController ? { controller: scrollController } : {})}
      className={styles.screenshotUploadPanelScreenshotInfoScrollable}>
      {creatorNameIsEmpty && (
        <div className={styles.screenshotUploadPanelWarning}>
          {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.CREATOR_NAME_IS_EMPTY')}
        </div>
      )}

      {!screenshotSnapshot.areSettingsTopQuality && (
        <div className={styles.screenshotUploadPanelWarning}>
          {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.SETTINGS_NOT_TOP_QUALITY')}
        </div>
      )}

      <div className={styles.screenshotUploadPanelForm} onMouseEnter={playHoverSound}>
        <div
          className={classNames(
            styles.screenshotUploadPanelFormField,
            styles.screenshotUploadPanelFormFieldInline,
            { [styles.screenshotUploadPanelFormFieldChecked]: formValue.shareModIds }
          )}
          onMouseEnter={playHoverSound}
          onClick={() => (
            patchFormValue({ shareModIds: !formValue.shareModIds }), playSound('select-toggle')
          )}>
          <Checkbox
            theme={checkboxTheme}
            checked={formValue.shareModIds}
            onChange={checked => patchFormValue({ shareModIds: checked })}
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
          className={classNames(
            styles.screenshotUploadPanelFormField,
            styles.screenshotUploadPanelFormFieldInline,
            { [styles.screenshotUploadPanelFormFieldChecked]: formValue.shareRenderSettings }
          )}
          onMouseEnter={playHoverSound}
          onClick={() => (
            patchFormValue({ shareRenderSettings: !formValue.shareRenderSettings }),
            playSound('select-toggle')
          )}>
          <Checkbox
            theme={checkboxTheme}
            checked={formValue.shareRenderSettings}
            onChange={checked => patchFormValue({ shareRenderSettings: checked })}
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
            className={classNames(
              styles.screenshotUploadPanelFormField,
              styles.screenshotUploadPanelFormFieldInline,
              {
                [styles.screenshotUploadPanelFormFieldChecked]: formValue.isShowcasingAsset,
                [styles.screenshotUploadPanelFormFieldInvalid]:
                  formValue.isShowcasingAsset && !formValue.showcasedMod
              }
            )}
            onMouseEnter={playHoverSound}
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
              onChange={checked =>
                patchFormValue({
                  isShowcasingAsset: checked,
                  showcasedMod: checked ? formValue.showcasedMod : undefined
                })
              }
            />

            <div className={styles.screenshotUploadPanelFormFieldBlock}>
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
                        styles.screenshotUploadPanelFormDropdownTogglePreviewItem
                      )}>
                      <div
                        className={styles.screenshotUploadPanelFormDropdownToggleItemImage}
                        style={{ backgroundImage: `url(${formValue.showcasedMod.thumbnailPath})` }}
                      />
                      {formValue.showcasedMod.displayName}
                    </div>
                  ) : (
                    <div
                      className={classNames(
                        dropdownTheme.dropdownItem,
                        styles.screenshotUploadPanelFormDropdownTogglePreviewItem
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
          className={classNames(
            styles.screenshotUploadPanelFormField,
            styles.screenshotUploadPanelFormFieldBlock
          )}
          style={{ margin: 0 }}
          onMouseEnter={playHoverSound}>
          <label>
            {`${translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_DESCRIPTION_LABEL')} β`}
            <br />
            <small>
              {translate('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_DESCRIPTION_DESCRIPTION')}
            </small>
          </label>

          <div className={styles.screenshotUploadPanelFormTextareaWrapper}>
            <textarea
              rows={textareaFocused || formValue.description.length > 0 ? 5 : 1}
              maxLength={4000}
              value={formValue.description}
              onFocus={() => setTextareaFocused(true)}
              onBlur={() => setTextareaFocused(false)}
              onChange={event => patchFormValue({ description: event.target.value })}
            />

            {(textareaFocused || formValue.description.length > 0) && (
              <div className={styles.screenshotUploadPanelFormTextareaWrapperControls}>
                {formValue.description.length == 0 && settings.savedScreenshotDescription && (
                  <Button
                    variant='default'
                    className={styles.screenshotUploadPanelFormTextareaWrapperControlsButton}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() =>
                      patchFormValue({ description: settings.savedScreenshotDescription })
                    }>
                    Restore latest description
                  </Button>
                )}

                <Button
                  variant='default'
                  className={styles.screenshotUploadPanelFormTextareaWrapperControlsButton}
                  // use visibility to avoid a small layout shift when the button appears.
                  style={{ visibility: formValue.description.length > 0 ? 'visible' : 'hidden' }}
                  onClick={() => patchFormValue({ description: '' })}>
                  {translate('Editor.CLEAR', 'Clear')}
                </Button>

                <div style={{ flex: 1 }} />

                <span>{formValue.description.length}&thinsp;/&thinsp;4000</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div className={styles.screenshotUploadPanelContent}>
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

function ScreenshotUploadPanelFooter({
  creatorNameIsEmpty,
  uploadProgress,
  draggable,
  formValue
}: Readonly<{
  creatorNameIsEmpty: boolean;
  uploadProgress: JsonUploadProgress | null;
  draggable: DraggableProps;
  formValue: ScreenshotInfoFormValue;
}>): ReactElement {
  const { translate } = useLocalization();

  const isUploading = uploadProgress != null && !uploadProgress.isComplete;
  const isIdleOrUploading = !uploadProgress?.isComplete;
  const isDoneUploading = uploadProgress?.isComplete == true;

  return (
    <div className={styles.screenshotUploadPanelFooter} {...draggable}>
      {isIdleOrUploading && (
        <>
          <Button
            className={classNames(
              styles.screenshotUploadPanelFooterButton,
              styles.screenshotUploadPanelFooterButtonCancel
            )}
            variant='primary'
            disabled={isUploading}
            onSelect={discardScreenshot}
            selectSound='close-panel'>
            {translate('Common.ACTION[Cancel]', 'Cancel')}
          </Button>

          <Button
            variant='primary'
            className={styles.screenshotUploadPanelFooterButton}
            disabled={creatorNameIsEmpty || isUploading}
            onSelect={() => uploadScreenshot(formValue)}>
            <Icon
              src={cloudArrowUpSolidSrc}
              tinted={true}
              className={styles.screenshotUploadPanelFooterButtonIcon}
            />

            {isUploading
              ? translate('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOADING')
              : translate('HallOfFame.UI.Game.ScreenshotUploadPanel.SHARE')}
          </Button>
        </>
      )}

      {isDoneUploading && (
        <Button
          variant='primary'
          className={styles.screenshotUploadPanelFooterButton}
          onSelect={discardScreenshot}
          selectSound='close-menu'>
          {translate('Common.CLOSE', 'Close')}
        </Button>
      )}
    </div>
  );
}

/**
 * Gets a random congratulation message (displayed in the dialog header).
 */
function getCongratulation(translate: Localization['translate']): string {
  // biome-ignore lint/style/noNonNullAssertion: translation controlled by us.
  const congratulations = translate(
    'HallOfFame.UI.Game.ScreenshotUploadPanel.CONGRATULATIONS'
  )!.split('\n'); // A newline separates each message.

  // biome-ignore lint/style/noNonNullAssertion: always has at least 1 element.
  return congratulations[Math.floor(Math.random() * congratulations.length)]!;
}

/**
 * Computes the type and style of the ratio preview overlay on the image, helping the user to
 * understand how the image will be cropped on the most common aspect ratio, 16:9.
 */
function getRatioPreviewInfo(screenshot: JsonScreenshotSnapshot) {
  const mostCommonRatio = 16 / 9;

  const ratio = screenshot.imageWidth / screenshot.imageHeight;

  const type = ratio == mostCommonRatio ? 'equal' : ratio > mostCommonRatio ? 'narrower' : 'wider';

  // We use 99% as a max below to leave a small padding around the preview ration rectangle, making
  // it cleaner than if it hits the edge of the image.
  // Note that `calc(100% - Xrem)` which would be better, is not supported by cohtml.
  const style = {
    width: type == 'wider' ? '99%' : `${(mostCommonRatio / ratio) * 100}%`,
    height: type == 'wider' ? `${(ratio / mostCommonRatio) * 100}%` : '99%'
  } satisfies CSSProperties;

  return { type, style } as const;
}

function getRandomUploadSuccessImage(): string {
  const images = [
    'Media/Game/Climate/Sun.svg',
    'Media/Game/Icons/Content.svg',
    'Media/Game/Icons/Happy.svg',
    'Media/Game/Icons/TouristAttractions.svg',
    'Media/Game/Icons/Trophy.svg',
    'Media/Game/Notifications/LeveledUp.svg'
  ];

  // biome-ignore lint/style/noNonNullAssertion: always has at least 1 element.
  return images[Math.floor(Math.random() * images.length)]!;
}

/**
 * Gets the hint text for the upload progress depending on the state of {@link uploadProgress}
 * (pending, uploading, processing).
 */
function getUploadProgressHintText(
  translate: Localization['translate'],
  uploadProgress: JsonUploadProgress
): string | null {
  if (uploadProgress.uploadProgress == 0) {
    return translate('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Waiting]');
  }

  if (uploadProgress.uploadProgress > 0 && uploadProgress.processingProgress == 0) {
    return translate('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Uploading]');
  }

  if (uploadProgress.processingProgress > 0 && !uploadProgress.isComplete) {
    return translate('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Processing]');
  }

  if (uploadProgress.isComplete) {
    return translate('HallOfFame.UI.Game.ScreenshotUploadPanel.UPLOAD_PROGRESS[Complete]');
  }

  return null;
}

function showFullscreenImage(src: string): void {
  const div = document.createElement('div');

  div.classList.add(styles.fullscreenImage);
  div.style.backgroundImage = `url(${src})`;

  document.body.appendChild(div);

  div.addEventListener('click', () => {
    document.body.removeChild(div);
  });
}

function discardScreenshot(): void {
  trigger('hallOfFame.capture', 'clearScreenshot');
}

function uploadScreenshot(formValue: ScreenshotInfoFormValue): void {
  if (formValue.isShowcasingAsset && !formValue.showcasedMod) {
    return;
  }

  const backendFormValue = {
    shareModIds: formValue.shareModIds,
    shareRenderSettings: formValue.shareRenderSettings,
    showcasedModId:
      formValue.isShowcasingAsset && formValue.showcasedMod ? formValue.showcasedMod.id : null,
    description: formValue.description.trim() || null
  };

  trigger('hallOfFame.capture', 'uploadScreenshot', backendFormValue);
}
