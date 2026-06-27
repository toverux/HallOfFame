import classNames from 'classnames';
import { ControlIcons } from 'cs2/input';
import { LocalizedNumber, LocalizedString, useLocalization } from 'cs2/l10n';
import { Button, Icon, MenuButton, Tooltip, type TooltipProps } from 'cs2/ui';
import {
  type CSSProperties,
  memo,
  type ReactElement,
  useCallback,
  useEffect,
  useState
} from 'react';
import * as bindings from '../bindings';
import { type CreatorSocialLink, type Screenshot, supportedSocialPlatforms } from '../common';
// biome-ignore-start lint/correctness/noPrivateImports: svgs don't have @public annotations
import discordBrandsSolid from '../icons/fontawesome/discord-brands-solid.svg';
import ellipsisSolidSrc from '../icons/fontawesome/ellipsis-solid.svg';
import flagSolidSrc from '../icons/fontawesome/flag-solid.svg';
import twitchBrandsSolid from '../icons/fontawesome/twitch-brands-solid.svg';
import youtubeBrandsSolid from '../icons/fontawesome/youtube-brands-solid.svg';
import loveChirperSrc from '../icons/love-chirper.png';
import naturalResourcesSrc from '../icons/paradox/natural-resources.svg';
import populationSrc from '../icons/paradox/population.svg';
import trophySrc from '../icons/paradox/trophy.svg';
import doubleArrowRightTriangleSrc from '../icons/uil/colored/double-arrow-right-triangle.svg';
import eyeClosedSrc from '../icons/uil/colored/eye-closed.svg';
import eyeOpenSrc from '../icons/uil/colored/eye-open.svg';
// biome-ignore-end lint/correctness/noPrivateImports: svgs don't have @public annotations
import { snappyOnSelect } from '../utils';
import * as styles from './menu-controls.module.scss';
import { formatBigNumber, locElementToReactNode } from './menu-controls-utils';
import { useMenuControlsInputAction } from './use-menu-controls-input-action';

let lastForcedRefreshIndex = 0;

const previousScreenshotInputAction = bindings.bindInputAction(
  'hallOfFame.presenter',
  'previousScreenshotInputAction'
);

const nextScreenshotInputAction = bindings.bindInputAction(
  'hallOfFame.presenter',
  'nextScreenshotInputAction'
);

const likeScreenshotInputAction = bindings.bindInputAction(
  'hallOfFame.presenter',
  'likeScreenshotInputAction'
);

const toggleMenuInputAction = bindings.bindInputAction(
  'hallOfFame.presenter',
  'toggleMenuInputAction'
);

const socialPlatforms: {
  [K in CreatorSocialLink['platform']]: Readonly<{ name: string; logo: string; color: string }>;
} = {
  discord: { name: 'Discord', logo: discordBrandsSolid, color: '#5865F2' },
  paradoxmods: { name: 'Paradox Mods', logo: 'Media/Glyphs/ParadoxMods.svg', color: '#5abe41' },
  twitch: { name: 'Twitch', logo: twitchBrandsSolid, color: '#8956FB' },
  youtube: { name: 'YouTube', logo: youtubeBrandsSolid, color: '#FF0000' }
};

/**
 * Component that renders the menu controls and city/creator information.
 */
export function MenuControls(): ReactElement {
  return (
    <div className={styles.menuControlsContainer}>
      {/* Subcomponent just to avoid one stupid level of indentation! */}
      <MenuControlsContent />
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: splitting further would make it too complex.
export function MenuControlsContent(): ReactElement {
  const { translate } = useLocalization();

  const modSettings = bindings.useModSettings();

  const [menuState, setMenuState] = bindings.useHofMenuState();

  const [showMoreActions, setShowOtherActions] = useState(false);

  useEffect(() => {
    if (menuState.forcedRefreshIndex != lastForcedRefreshIndex) {
      setTimeout(() => bindings.nextScreenshot(), 500);
      lastForcedRefreshIndex = menuState.forcedRefreshIndex;
    }
  }, [menuState.forcedRefreshIndex]);

  const openShowcasedModPage = useCallback(
    // biome-ignore lint/style/noNonNullAssertion: will not be null here
    () => bindings.openModPage(menuState.screenshot!.showcasedMod!),
    [menuState.screenshot]
  );

  const toggleMoreActions = useCallback(() => setShowOtherActions(prev => !prev), []);

  const openGeneralModSettings = useCallback(() => bindings.openModSettings('General'), []);

  // Stable thanks to the functional update and the singleton's stable setter, so the memoized
  // toggle button only re-renders when `isMenuVisible` actually changes.
  const toggleMenuVisibility = useCallback(
    () => setMenuState(prev => ({ ...prev, isMenuVisible: !prev.isMenuVisible })),
    [setMenuState]
  );

  if (menuState.error) {
    // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
    return (
      <div className={styles.menuControls}>
        <MenuControlsError
          error={menuState.error}
          isReadyForNextImage={menuState.isReadyForNextImage}
        />
      </div>
    );
  }

  if (!menuState.screenshot) {
    // biome-ignore lint/complexity/noUselessFragments: we need to return a ReactElement.
    return <></>;
  }

  return (
    <div
      className={classNames(styles.menuControls, styles.menuControlsApplyButtonsOffset)}
      // biome-ignore lint/performance/noJsxPropsBind: host element does not bail out on prop identity
      onMouseLeave={() => setShowOtherActions(false)}>
      {modSettings.showFeaturedAsset && menuState.screenshot.showcasedMod && (
        <Button
          variant='menu'
          className={styles.menuControlsAssetButton}
          onSelect={openShowcasedModPage}>
          <div
            className={styles.menuControlsAssetButtonThumbnail}
            style={{ backgroundImage: `url(${menuState.screenshot.showcasedMod.thumbnailUrl})` }}
          />

          <section className={styles.menuControlsAssetButtonText}>
            <span className={styles.menuControlsAssetButtonTextHeader}>
              <Icon src='Media/Glyphs/ParadoxMods.svg' tinted={true} />
              {menuState.screenshot.showcasedMod.tags.includes('Map')
                ? translate('HallOfFame.UI.Menu.MenuControls.SHOWCASED_MAP')
                : translate('HallOfFame.UI.Menu.MenuControls.SHOWCASED_ASSET')}
            </span>

            <span className={styles.menuControlsAssetButtonTextTitle}>
              {menuState.screenshot.showcasedMod.name}
            </span>

            <span className={styles.menuControlsAssetButtonTextAuthor}>
              <LocalizedString
                id='HallOfFame.Common.CITY_BY'
                // biome-ignore lint/style/useNamingConvention: i18n convention
                args={{ CREATOR_NAME: menuState.screenshot.showcasedMod.authorName }}
              />
            </span>

            {menuState.screenshot.showcasedMod.shortDescription && (
              <span className={styles.menuControlsAssetButtonTextDescription}>
                {menuState.screenshot.showcasedMod.shortDescription}
              </span>
            )}
          </section>
        </Button>
      )}

      <div className={styles.menuControlsSection}>
        <div className={styles.menuControlsSectionButtons} style={{ alignSelf: 'flex-end' }}>
          <MenuControlsNextButton isLoading={!menuState.isReadyForNextImage} />

          <MenuControlsPreviousButton
            isLoading={!menuState.isReadyForNextImage}
            hasPreviousScreenshot={menuState.hasPreviousScreenshot}
          />

          <MenuControlsToggleMenuVisibilityButton
            isMenuVisible={menuState.isMenuVisible}
            toggleMenuVisibility={toggleMenuVisibility}
          />
        </div>

        <div className={styles.menuControlsSectionContent} style={{ alignSelf: 'flex-start' }}>
          <MenuControlsCityName screenshot={menuState.screenshot} />

          <MenuControlsScreenshotLabels
            modSettings={modSettings}
            screenshot={menuState.screenshot}
          />
        </div>
      </div>

      <div className={styles.menuControlsSection}>
        <div className={styles.menuControlsSectionButtons}>
          <MenuControlsLikeButton screenshot={menuState.screenshot} />
        </div>

        <div
          className={classNames(styles.menuControlsSectionContent, styles.menuControlsLikesCount)}>
          <span className={styles.menuControlsLikesCountNumber}>
            {menuState.screenshot.likesCount < 1000
              ? menuState.screenshot.likesCount
              : `${(menuState.screenshot.likesCount / 1000).toFixed(1)} k`}
          </span>
          {/** biome-ignore lint/style/noJsxLiterals: it's kinda okay */}
          &thinsp;
          {translate(
            menuState.screenshot.likesCount == 0
              ? 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Zero]'
              : menuState.screenshot.likesCount == 1
                ? 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Singular]'
                : 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Plural]'
          )}
        </div>
      </div>

      <div
        className={classNames(styles.menuControlsSection, styles.menuControlsSectionOtherActions)}>
        <div className={styles.menuControlsSectionButtons}>
          <MenuButton
            className={styles.menuControlsSectionButtonsButton}
            src={ellipsisSolidSrc}
            tinted={true}
            onSelect={toggleMoreActions}
          />
        </div>

        <div
          className={classNames(styles.menuControlsSectionContent, {
            [styles.menuControlsSectionContentSlideIn]: showMoreActions
          })}>
          <Tooltip
            direction='down'
            tooltip={
              <LocalizedString
                id='HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Save]'
                // biome-ignore lint/style/useNamingConvention: i18n convention
                args={{ DIRECTORY: modSettings.creatorsScreenshotSaveDirectory }}
              />
            }>
            <Button
              className={menuState.isSaving ? styles.menuControlsSectionContentButtonSaveSpin : ''}
              variant='menu'
              src={menuState.isSaving ? 'Media/Glyphs/Progress.svg' : 'Media/Editor/Save.svg'}
              tinted={true}
              disabled={menuState.isSaving}
              onSelect={bindings.saveScreenshot}>
              <span>{translate('HallOfFame.UI.Menu.MenuControls.ACTION[Save]')}</span>
            </Button>
          </Tooltip>

          <Tooltip
            direction='down'
            tooltip={translate('HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Report]')}>
            <Button
              variant='menu'
              src={flagSolidSrc}
              tinted={true}
              onSelect={bindings.reportScreenshot}
              selectSound='bulldoze'>
              <span>{translate('HallOfFame.UI.Menu.MenuControls.ACTION[Report]')}</span>
            </Button>
          </Tooltip>

          <Tooltip
            direction='down'
            tooltip={translate(
              'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Open Mod Settings]'
            )}>
            <Button
              className={styles.menuControlsSectionContentButtonSettings}
              variant='menu'
              src='Media/Glyphs/Gear.svg'
              tinted={true}
              onSelect={openGeneralModSettings}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: that's okay, but yeah.
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: splitting would make it too complex.
const MenuControlsCityName = memo(function MenuControlsCityNameBase({
  screenshot
}: Readonly<{
  screenshot: Screenshot;
}>): ReactElement | null {
  const { translate } = useLocalization();

  const gameLocale = bindings.useLocale();

  const modSettings = bindings.useModSettings();

  const [showTranslations, setShowTranslations] = useState(false);

  const isCityNameTranslated =
    modSettings.namesTranslationMode != 'disabled' &&
    screenshot.cityNameLocale != null &&
    !gameLocale.startsWith(screenshot.cityNameLocale);

  const isCreatorNameTranslated =
    modSettings.namesTranslationMode != 'disabled' &&
    screenshot.creator.creatorNameLocale != null &&
    !gameLocale.startsWith(screenshot.creator.creatorNameLocale);

  const cityName = isCityNameTranslated
    ? modSettings.namesTranslationMode == 'transliterate'
      ? screenshot.cityNameLatinized
      : screenshot.cityNameTranslated
    : screenshot.cityName;

  const creatorName =
    (isCreatorNameTranslated
      ? modSettings.namesTranslationMode == 'transliterate'
        ? screenshot.creator.creatorNameLatinized
        : screenshot.creator.creatorNameTranslated
      : screenshot.creator.creatorName) || 'anonymous';

  const supportedSocials = screenshot.creator.socials
    .filter(link => supportedSocialPlatforms.includes(link.platform))
    .sort(
      (a, b) =>
        supportedSocialPlatforms.indexOf(a.platform) - supportedSocialPlatforms.indexOf(b.platform)
    );

  return (
    <div className={styles.menuControlsNames}>
      {(isCityNameTranslated || isCreatorNameTranslated) && (
        <div
          className={styles.menuControlsNamesTranslatedHint}
          // biome-ignore lint/performance/noJsxPropsBind: host element does not bail out on prop identity
          onMouseEnter={() => setShowTranslations(true)}
          // biome-ignore lint/performance/noJsxPropsBind: host element does not bail out on prop identity
          onMouseLeave={() => setShowTranslations(false)}>
          <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>
            <path
              fill='white'
              d='m190 230 57 58-21 51-72-73-85 85-36-37 84-84-22-22c-14-14-26-33-33-54h56c4 7 8 13 13 18l23 23 22-23c16-16 29-48 29-70H0V51h128V0h51v51h128v51h-51c0 36-19 81-43 106l-23 22zm98 205-32 77h-51l128-307h51l128 307h-51l-32-77H288zm21-51h99l-49-118-50 118z'
            />
          </svg>
          {translate('HallOfFame.UI.Menu.MenuControls.TRANSLATED')}
        </div>
      )}

      <div className={styles.menuControlsNamesCity}>
        <Tooltip
          direction='right'
          disabled={!isCityNameTranslated}
          forceVisible={showTranslations && isCityNameTranslated}
          tooltip={
            <div className={styles.menuControlsNamesTranslatedTooltip}>
              <strong>{screenshot.cityName}</strong>
              {modSettings.namesTranslationMode == 'translate'
                ? screenshot.cityNameLatinized
                : screenshot.cityNameTranslated}
            </div>
          }>
          <span>{cityName}</span>
        </Tooltip>
      </div>

      <div className={styles.menuControlsNamesCreator}>
        <Tooltip
          direction={isCityNameTranslated ? 'down' : 'right'}
          disabled={!isCreatorNameTranslated}
          forceVisible={showTranslations && isCreatorNameTranslated}
          tooltip={
            <div className={styles.menuControlsNamesTranslatedTooltip}>
              <strong>{screenshot.creator.creatorName}</strong>
              {modSettings.namesTranslationMode == 'translate'
                ? screenshot.creator.creatorNameLatinized
                : screenshot.creator.creatorNameTranslated}
            </div>
          }>
          <span className={styles.menuControlsNamesCreatorBy}>
            <LocalizedString
              id='HallOfFame.Common.CITY_BY'
              // biome-ignore lint/style/useNamingConvention: i18n convention
              args={{ CREATOR_NAME: creatorName }}
            />
          </span>
        </Tooltip>

        {modSettings.showCreatorSocials && (
          <div className={styles.menuControlsNamesCreatorSocials}>
            {supportedSocials.map(link => (
              <Tooltip
                key={link.platform}
                tooltip={
                  <LocalizedString
                    id='HallOfFame.UI.Menu.MenuControls.FIND_CREATOR_X_ON_Y_TOOLTIP'
                    args={{
                      // biome-ignore lint/style/useNamingConvention: i18n convention
                      CREATOR_NAME: creatorName,
                      // biome-ignore lint/style/useNamingConvention: i18n convention
                      SOCIAL_PLATFORM: socialPlatforms[link.platform].name
                    }}
                  />
                }
                direction='down'>
                <Button
                  className={styles.menuControlsNamesCreatorSocialsButton}
                  variant='round'
                  tinted={true}
                  src={socialPlatforms[link.platform].logo}
                  style={{ '--brand-color': socialPlatforms[link.platform].color } as CSSProperties}
                  // biome-ignore lint/performance/noJsxPropsBind: handler closes over the mapped item, cannot be a single stable ref
                  onSelect={() => bindings.openSocialLink(link)}
                />
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

const MenuControlsScreenshotLabels = memo(function MenuControlsScreenshotLabelsBase({
  modSettings,
  screenshot
}: Readonly<{
  modSettings: bindings.ModSettings;
  screenshot: Screenshot;
}>): ReactElement {
  const { translate } = useLocalization();

  // Do not show the pop/milestone labels if this is an empty map screenshot, which is likely when
  // the pop is 0 and the milestone is 0 (Founding) or 20 (Megalopolis, i.e., creative mode).
  const isPristineWilderness =
    screenshot.cityPopulation == 0 &&
    (screenshot.cityMilestone == 0 || screenshot.cityMilestone == 20);

  // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
  return (
    <div className={styles.menuControlsSectionScreenshotLabels}>
      {isPristineWilderness ? (
        <span className={styles.menuControlsSectionScreenshotLabelsLabel}>
          <img
            src={naturalResourcesSrc}
            className={styles.menuControlsSectionScreenshotLabelsLabelIcon}
          />
          {translate(`HallOfFame.UI.Menu.MenuControls.LABEL[Pristine Wilderness]`)}
        </span>
      ) : (
        <>
          <span className={styles.menuControlsSectionScreenshotLabelsLabel}>
            <img src={trophySrc} className={styles.menuControlsSectionScreenshotLabelsLabelIcon} />
            {translate(`Progression.MILESTONE_NAME:${screenshot.cityMilestone}`, `???`)}
          </span>

          <span className={styles.menuControlsSectionScreenshotLabelsLabel}>
            <img
              src={populationSrc}
              className={styles.menuControlsSectionScreenshotLabelsLabelIcon}
            />
            {formatBigNumber(screenshot.cityPopulation, translate)}
          </span>
        </>
      )}

      {modSettings.showViewCount && (
        <Tooltip
          tooltip={
            <LocalizedString
              id='HallOfFame.UI.Menu.MenuControls.LABEL_TOOLTIP[Views]'
              args={{
                // biome-ignore lint/style/useNamingConvention: i18n convention
                VIEWS_COUNT: <LocalizedNumber value={screenshot.viewsCount} />,
                // biome-ignore lint/style/useNamingConvention: i18n convention
                UNIQUE_VIEWS_COUNT: <LocalizedNumber value={screenshot.uniqueViewsCount} />
              }}
            />
          }>
          <span className={styles.menuControlsSectionScreenshotLabelsLabel}>
            <img src={eyeOpenSrc} className={styles.menuControlsSectionScreenshotLabelsLabelIcon} />
            {formatBigNumber(screenshot.uniqueViewsCount, translate)}
          </span>
        </Tooltip>
      )}

      <Tooltip tooltip={screenshot.createdAtFormatted}>
        <span className={styles.menuControlsSectionScreenshotLabelsLabel}>
          {screenshot.createdAtFormattedDistance}
        </span>
      </Tooltip>
    </div>
  );
});

const MenuControlsNextButton = memo(function MenuControlsNextButtonBase({
  isLoading
}: Readonly<{
  isLoading: boolean;
}>): ReactElement {
  const disabled = isLoading;

  const { translate } = useLocalization();

  const { useInputBinding, useInputPhase } = nextScreenshotInputAction;

  const binding = useInputBinding();
  const phase = useInputPhase();

  useMenuControlsInputAction(
    phase,
    // setTimeout is used to give time to the key press .*active class to show briefly before
    // [disabled] is set.
    () => !disabled && (setTimeout(bindings.nextScreenshot), true),
    'select-item'
  );

  const activeClass =
    phase == 'Performed' && !disabled ? styles.menuControlsSectionButtonsButtonActive : '';

  return (
    <MenuButtonTooltip
      binding={binding}
      tooltip={translate('HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Next]')}>
      <MenuButton
        className={classNames(
          styles.menuControlsSectionButtonsButton,
          styles.menuControlsSectionButtonsButtonNext,
          activeClass
        )}
        src={doubleArrowRightTriangleSrc}
        tinted={isLoading}
        disabled={isLoading}
        {...snappyOnSelect(bindings.nextScreenshot)}
      />
    </MenuButtonTooltip>
  );
});

const MenuControlsPreviousButton = memo(function MenuControlsPreviousButtonBase({
  isLoading,
  hasPreviousScreenshot
}: Readonly<{
  isLoading: boolean;
  hasPreviousScreenshot: boolean;
}>): ReactElement {
  const disabled = isLoading || !hasPreviousScreenshot;

  const { translate } = useLocalization();

  const { useInputBinding, useInputPhase } = previousScreenshotInputAction;

  const binding = useInputBinding();
  const phase = useInputPhase();

  useMenuControlsInputAction(
    phase,
    // setTimeout is used to give time to the key press .*active class to show briefly before
    // [disabled] is set.
    () => !disabled && (setTimeout(bindings.previousScreenshot), true),
    'select-item'
  );

  const activeClass =
    phase == 'Performed' && !disabled ? styles.menuControlsSectionButtonsButtonActive : '';

  return (
    <MenuButtonTooltip
      binding={binding}
      tooltip={translate('HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Previous]')}>
      <MenuButton
        className={classNames(
          styles.menuControlsSectionButtonsButton,
          styles.menuControlsSectionButtonsButtonPrevious,
          activeClass
        )}
        src={doubleArrowRightTriangleSrc}
        tinted={disabled}
        disabled={disabled}
        {...snappyOnSelect(bindings.previousScreenshot)}
      />
    </MenuButtonTooltip>
  );
});

const MenuControlsToggleMenuVisibilityButton = memo(MenuControlsToggleMenuVisibilityButtonBase);

function MenuControlsToggleMenuVisibilityButtonBase({
  isMenuVisible,
  toggleMenuVisibility
}: Readonly<{
  isMenuVisible: boolean;
  toggleMenuVisibility: () => void;
}>): ReactElement {
  const selectSound = isMenuVisible ? 'close-menu' : 'open-menu';

  const { translate } = useLocalization();

  const { useInputBinding, useInputPhase } = toggleMenuInputAction;

  const binding = useInputBinding();
  const phase = useInputPhase();

  useMenuControlsInputAction(phase, toggleMenuVisibility, selectSound);

  const activeClass = phase == 'Performed' ? styles.menuControlsSectionButtonsButtonActive : '';

  return (
    <MenuButtonTooltip
      binding={binding}
      tooltip={translate('HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Toggle Menu]')}>
      <MenuButton
        className={classNames(styles.menuControlsSectionButtonsButton, activeClass)}
        src={isMenuVisible ? eyeOpenSrc : eyeClosedSrc}
        tinted={false}
        {...snappyOnSelect(toggleMenuVisibility, selectSound)}
      />
    </MenuButtonTooltip>
  );
}

const MenuControlsLikeButton = memo(function MenuControlsLikeButtonBase({
  screenshot
}: Readonly<{
  screenshot: Screenshot;
}>): ReactElement {
  const selectSound = screenshot.isLiked ? 'chirp-event' : 'xp-event';

  const { useInputBinding, useInputPhase } = likeScreenshotInputAction;

  const binding = useInputBinding();
  const phase = useInputPhase();

  useMenuControlsInputAction(phase, bindings.likeScreenshot, selectSound);

  const activeClass =
    phase == 'Performed'
      ? screenshot.isLiked
        ? styles.menuControlsSectionButtonsButtonLikeLikedActive
        : styles.menuControlsSectionButtonsButtonActive
      : '';

  return (
    <MenuButtonTooltip
      binding={binding}
      tooltip={
        <LocalizedString
          id={
            screenshot.isLiked
              ? 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Remove Like]'
              : screenshot.likesCount == 0
                ? 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Like Zero]'
                : screenshot.likesCount == 1
                  ? 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Like Singular]'
                  : 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Like Plural]'
          }
          args={{
            // biome-ignore lint/style/useNamingConvention: i18n convention
            NUMBER: <LocalizedNumber value={screenshot.likesCount} />,
            // biome-ignore lint/style/useNamingConvention: i18n convention
            LIKING_PERCENTAGE: <LocalizedNumber value={screenshot.likingPercentage} />
          }}
        />
      }>
      <MenuButton
        className={classNames(
          styles.menuControlsSectionButtonsButton,
          styles.menuControlsSectionButtonsButtonLike,
          {
            [styles.menuControlsSectionButtonsButtonLikeLiked]: screenshot.isLiked
          },
          activeClass
        )}
        src={loveChirperSrc}
        tinted={false}
        onSelect={bindings.likeScreenshot}
        selectSound={selectSound}
      />
    </MenuButtonTooltip>
  );
});

const MenuControlsError = memo(function MenuControlsErrorBase({
  error,
  isReadyForNextImage
}: Readonly<{
  error: LocalizedString;
  isReadyForNextImage: boolean;
}>): ReactElement {
  const { translate } = useLocalization();

  return (
    <div className={styles.menuControlsError}>
      <div className={styles.menuControlsErrorHeader}>
        <div
          className={styles.menuControlsErrorHeaderImage}
          style={{ backgroundImage: 'url(Media/Game/Icons/AdvisorTrafficAccident.svg)' }}
        />
        <div className={styles.menuControlsErrorHeaderText}>
          <strong>{translate('HallOfFame.Common.OOPS')}</strong>
          {translate('HallOfFame.UI.Menu.MenuControls.COULD_NOT_LOAD_IMAGE')}
        </div>
      </div>

      <LocalizedString
        id={error.id}
        fallback={error.value}
        args={{
          // biome-ignore lint/style/useNamingConvention: i18n convention
          ERROR_MESSAGE: locElementToReactNode(error.args?.ERROR_MESSAGE, 'Unknown error')
        }}
      />

      <strong className={styles.menuControlsErrorGameplayNotAffected}>
        {translate('HallOfFame.UI.Menu.MenuControls.GAMEPLAY_NOT_AFFECTED')}
      </strong>

      <MenuButton
        src='Media/Glyphs/ArrowCircular.svg'
        disabled={!isReadyForNextImage}
        {...snappyOnSelect(bindings.nextScreenshot)}>
        {translate('HallOfFame.UI.Menu.MenuControls.ACTION[Retry]')}
      </MenuButton>
    </div>
  );
});

function MenuButtonTooltip({
  tooltip,
  binding,
  children
}: Readonly<{
  tooltip: TooltipProps['tooltip'];
  binding: bindings.ProxyBinding;
  children: TooltipProps['children'];
}>): ReactElement {
  return (
    <Tooltip
      direction='right'
      tooltip={
        <div className={styles.menuControlsSectionButtonsButtonTooltip}>
          {tooltip}

          <ControlIcons bindings={[binding.binding]} modifiers={binding.modifiers} />
        </div>
      }>
      {children}
    </Tooltip>
  );
}
