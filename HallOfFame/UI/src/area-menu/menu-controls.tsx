import { bindValue, trigger, useValue } from 'cs2/api';
import { ControlIcons } from 'cs2/input';
import {
  type LocElement,
  type Localization,
  LocalizedNumber,
  LocalizedString,
  useLocalization
} from 'cs2/l10n';
import { Button, MenuButton, Tooltip, type TooltipProps } from 'cs2/ui';
import { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import type { CreatorSocialLink, Screenshot } from '../common';
import discordBrandsSolid from '../icons/fontawesome/discord-brands-solid.svg';
import ellipsisSolidSrc from '../icons/fontawesome/ellipsis-solid.svg';
import flagSolidSrc from '../icons/fontawesome/flag-solid.svg';
import redditBrandsSolid from '../icons/fontawesome/reddit-brands-solid.svg';
import twitchBrandsSolid from '../icons/fontawesome/twitch-brands-solid.svg';
import youtubeBrandsSolid from '../icons/fontawesome/youtube-brands-solid.svg';
import loveChirperSrc from '../icons/love-chirper.png';
import naturalResourcesSrc from '../icons/paradox/natural-resources.svg';
import populationSrc from '../icons/paradox/population.svg';
import trophySrc from '../icons/paradox/trophy.svg';
import doubleArrowRightTriangleSrc from '../icons/uil/colored/double-arrow-right-triangle.svg';
import eyeClosedSrc from '../icons/uil/colored/eye-closed.svg';
import eyeOpenSrc from '../icons/uil/colored/eye-open.svg';
import {
  type ModSettings,
  type ProxyBinding,
  bindInputAction,
  snappyOnSelect,
  useModSettings
} from '../utils';
import * as styles from './menu-controls.module.scss';
import { useHofMenuState } from './menu-state-hook';

let lastForcedRefreshIndex = 0;

const locale$ = bindValue<string>('hallOfFame.common', 'locale', 'en-US');

const previousScreenshotInputAction = bindInputAction(
  'hallOfFame.presenter',
  'previousScreenshotInputAction'
);

const nextScreenshotInputAction = bindInputAction(
  'hallOfFame.presenter',
  'nextScreenshotInputAction'
);

const likeScreenshotInputAction = bindInputAction(
  'hallOfFame.presenter',
  'likeScreenshotInputAction'
);

const toggleMenuInputAction = bindInputAction('hallOfFame.presenter', 'toggleMenuInputAction');

const socialPlatforms: Record<
  CreatorSocialLink['platform'],
  { logo: string; color: string; order: number }
> = {
  paradoxMods: { logo: 'Media/Glyphs/ParadoxMods.svg', color: '#5abe41', order: 0 },
  youtube: { logo: youtubeBrandsSolid, color: '#FF0000', order: 1 },
  twitch: { logo: twitchBrandsSolid, color: '#8956FB', order: 2 },
  discordServer: { logo: discordBrandsSolid, color: '#5865F2', order: 3 },
  reddit: { logo: redditBrandsSolid, color: '#FF4500', order: 4 }
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

export function MenuControlsContent(): ReactElement {
  const { translate } = useLocalization();

  const modSettings = useModSettings();

  const [menuState, setMenuState] = useHofMenuState();

  const [showMoreActions, setShowOtherActions] = useState(false);

  useEffect(() => {
    if (menuState.forcedRefreshIndex != lastForcedRefreshIndex) {
      setTimeout(() => nextScreenshot(), 500);
      lastForcedRefreshIndex = menuState.forcedRefreshIndex;
    }
  }, [menuState.forcedRefreshIndex]);

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
    return <></>;
  }

  return (
    <div
      className={`${styles.menuControls} ${styles.menuControlsApplyButtonsOffset}`}
      onMouseLeave={() => setShowOtherActions(false)}>
      <div className={styles.menuControlsSection}>
        <div className={styles.menuControlsSectionButtons} style={{ alignSelf: 'flex-end' }}>
          <MenuControlsNextButton isLoading={!menuState.isReadyForNextImage} />

          <MenuControlsPreviousButton
            isLoading={!menuState.isReadyForNextImage}
            hasPreviousScreenshot={menuState.hasPreviousScreenshot}
          />

          <MenuControlsToggleMenuVisibilityButton
            isMenuVisible={menuState.isMenuVisible}
            toggleMenuVisibility={() =>
              setMenuState({
                ...menuState,
                isMenuVisible: !menuState.isMenuVisible
              })
            }
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
          <MenuControlsFavoriteButton screenshot={menuState.screenshot} />
        </div>

        <div className={`${styles.menuControlsSectionContent} ${styles.menuControlsFavoriteCount}`}>
          <span className={styles.menuControlsFavoriteCountNumber}>
            {menuState.screenshot.favoritesCount < 1000
              ? menuState.screenshot.favoritesCount
              : `${(menuState.screenshot.favoritesCount / 1000).toFixed(1)} k`}
          </span>
          &thinsp;
          {translate(
            menuState.screenshot.favoritesCount == 0
              ? 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Zero]'
              : menuState.screenshot.favoritesCount == 1
                ? 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Singular]'
                : 'HallOfFame.UI.Menu.MenuControls.N_LIKES[Plural]'
          )}
        </div>
      </div>

      <div className={`${styles.menuControlsSection} ${styles.menuControlsSectionOtherActions}`}>
        <div className={styles.menuControlsSectionButtons}>
          <MenuButton
            className={styles.menuControlsSectionButtonsButton}
            src={ellipsisSolidSrc}
            tinted={true}
            onSelect={() => setShowOtherActions(!showMoreActions)}
          />
        </div>

        <div
          className={`${styles.menuControlsSectionContent} ${
            showMoreActions ? styles.menuControlsSectionContentSlideIn : ''
          }`}>
          <Tooltip
            direction='down'
            tooltip={
              <LocalizedString
                id={'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Save]'}
                args={{
                  // biome-ignore lint/style/useNamingConvention: i18n convention
                  DIRECTORY: modSettings.creatorsScreenshotSaveDirectory
                }}
              />
            }>
            <Button
              className={menuState.isSaving ? styles.menuControlsSectionContentButtonSaveSpin : ''}
              variant='menu'
              src={menuState.isSaving ? 'Media/Glyphs/Progress.svg' : 'Media/Editor/Save.svg'}
              tinted={true}
              disabled={menuState.isSaving}
              onSelect={saveScreenshot}>
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
              onSelect={reportScreenshot}
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
              onSelect={() => openModSettings('General')}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: that's okay, but yeah
function MenuControlsCityName({
  screenshot
}: Readonly<{
  screenshot: Screenshot;
}>): ReactElement | null {
  const { translate } = useLocalization();

  const gameLocale = useValue(locale$);

  const modSettings = useModSettings();

  const [showTranslations, setShowTranslations] = useState(false);

  if (!screenshot.creator) {
    // This will not happen - unless we have a broken ObjectId reference.
    console.warn(`HoF: No creator information for screenshot ${screenshot.id}`);

    return null;
  }

  const isCityNameTranslated =
    modSettings.namesTranslationMode != 'disabled' &&
    !!screenshot.cityNameLocale &&
    !gameLocale.startsWith(screenshot.cityNameLocale);

  const isCreatorNameTranslated =
    modSettings.namesTranslationMode != 'disabled' &&
    !!screenshot.creator.creatorNameLocale &&
    !gameLocale.startsWith(screenshot.creator.creatorNameLocale);

  const cityName = isCityNameTranslated
    ? modSettings.namesTranslationMode == 'transliterate'
      ? screenshot.cityNameLatinized
      : screenshot.cityNameTranslated
    : screenshot.cityName;

  const creatorName = isCreatorNameTranslated
    ? modSettings.namesTranslationMode == 'transliterate'
      ? screenshot.creator.creatorNameLatinized
      : screenshot.creator.creatorNameTranslated
    : screenshot.creator.creatorName;

  const supportedSocials = screenshot.creator.social
    .filter(link => link.platform in socialPlatforms)
    .sort((a, b) => socialPlatforms[a.platform].order - socialPlatforms[b.platform].order);

  return (
    <div className={styles.menuControlsNames}>
      {(isCityNameTranslated || isCreatorNameTranslated) && (
        <div
          className={styles.menuControlsNamesTranslatedHint}
          onMouseEnter={() => setShowTranslations(true)}
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
          <span>
            <LocalizedString
              id='HallOfFame.Common.CITY_BY'
              // biome-ignore lint/style/useNamingConvention: i18n convention
              args={{ CREATOR_NAME: creatorName || 'anonymous' }}
            />
          </span>
        </Tooltip>

        {modSettings.showCreatorSocials && (
          <div className={styles.menuControlsNamesCreatorSocials}>
            {supportedSocials.map(link => (
              <Tooltip key={link.platform} tooltip={link.description} direction='down'>
                <Button
                  className={styles.menuControlsNamesCreatorSocialsButton}
                  variant='round'
                  tinted={true}
                  src={socialPlatforms[link.platform].logo}
                  style={{
                    // @ts-expect-error
                    '--brand-color': socialPlatforms[link.platform].color
                  }}
                  onSelect={() => openSocialLink(modSettings, link)}
                />
              </Tooltip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuControlsScreenshotLabels({
  modSettings,
  screenshot
}: Readonly<{
  modSettings: ModSettings;
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
        <span>
          <img src={naturalResourcesSrc} />
          {translate(`HallOfFame.UI.Menu.MenuControls.LABEL[Pristine Wilderness]`)}
        </span>
      ) : (
        <>
          <span>
            <img src={trophySrc} />
            {translate(`Progression.MILESTONE_NAME:${screenshot.cityMilestone}`, `???`)}
          </span>

          <span>
            <img src={populationSrc} />
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
                NUMBER: <LocalizedNumber value={screenshot.viewsCount} />,
                // biome-ignore lint/style/useNamingConvention: i18n convention
                VIEWS_PER_DAY: <LocalizedNumber value={screenshot.viewsPerDay} />
              }}
            />
          }>
          <span>
            <img src={eyeOpenSrc} />
            {formatBigNumber(screenshot.viewsCount, translate)}
          </span>
        </Tooltip>
      )}

      <Tooltip tooltip={screenshot.createdAtFormatted}>
        <span>{screenshot.createdAtFormattedDistance}</span>
      </Tooltip>
    </div>
  );
}

function MenuControlsNextButton({
  isLoading
}: Readonly<{
  isLoading: boolean;
}>): ReactElement {
  const disabled = isLoading;

  const { translate } = useLocalization();

  const { useInputBinding, useInputPhase, useOnInputPerformed } = nextScreenshotInputAction;

  useOnInputPerformed(
    // setTimeout is used to give time to the key press .*active class to show briefly before
    // [disabled] is set.
    () => !disabled && (setTimeout(nextScreenshot), true),
    'select-item'
  );

  const binding = useInputBinding();
  const phase = useInputPhase();

  const activeClass =
    phase == 'Performed' && !disabled ? styles.menuControlsSectionButtonsButtonActive : '';

  return (
    <MenuButtonTooltip
      binding={binding}
      tooltip={translate('HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Next]')}>
      <MenuButton
        className={`${styles.menuControlsSectionButtonsButton} ${styles.menuControlsSectionButtonsButtonNext} ${activeClass}`}
        src={doubleArrowRightTriangleSrc}
        tinted={isLoading}
        disabled={isLoading}
        {...snappyOnSelect(nextScreenshot)}
      />
    </MenuButtonTooltip>
  );
}

function MenuControlsPreviousButton({
  isLoading,
  hasPreviousScreenshot
}: Readonly<{
  isLoading: boolean;
  hasPreviousScreenshot: boolean;
}>): ReactElement {
  const disabled = isLoading || !hasPreviousScreenshot;

  const { translate } = useLocalization();

  const { useInputBinding, useInputPhase, useOnInputPerformed } = previousScreenshotInputAction;

  useOnInputPerformed(
    // setTimeout is used to give time to the key press .*active class to show briefly before
    // [disabled] is set.
    () => !disabled && (setTimeout(previousScreenshot), true),
    'select-item'
  );

  const binding = useInputBinding();
  const phase = useInputPhase();

  const activeClass =
    phase == 'Performed' && !disabled ? styles.menuControlsSectionButtonsButtonActive : '';

  return (
    <MenuButtonTooltip
      binding={binding}
      tooltip={translate('HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Previous]')}>
      <MenuButton
        className={`${styles.menuControlsSectionButtonsButton} ${styles.menuControlsSectionButtonsButtonPrevious} ${activeClass}`}
        src={doubleArrowRightTriangleSrc}
        tinted={disabled}
        disabled={disabled}
        {...snappyOnSelect(previousScreenshot)}
      />
    </MenuButtonTooltip>
  );
}

function MenuControlsToggleMenuVisibilityButton({
  isMenuVisible,
  toggleMenuVisibility
}: Readonly<{
  isMenuVisible: boolean;
  toggleMenuVisibility: () => void;
}>): ReactElement {
  const selectSound = isMenuVisible ? 'close-menu' : 'open-menu';

  const { translate } = useLocalization();

  const { useInputBinding, useInputPhase, useOnInputPerformed } = toggleMenuInputAction;

  useOnInputPerformed(toggleMenuVisibility, selectSound);

  const binding = useInputBinding();
  const phase = useInputPhase();

  const activeClass = phase == 'Performed' ? styles.menuControlsSectionButtonsButtonActive : '';

  return (
    <MenuButtonTooltip
      binding={binding}
      tooltip={translate('HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Toggle Menu]')}>
      <MenuButton
        className={`${styles.menuControlsSectionButtonsButton} ${activeClass}`}
        src={isMenuVisible ? eyeOpenSrc : eyeClosedSrc}
        tinted={false}
        {...snappyOnSelect(toggleMenuVisibility, selectSound)}
      />
    </MenuButtonTooltip>
  );
}

function MenuControlsFavoriteButton({
  screenshot
}: Readonly<{
  screenshot: Screenshot;
}>): ReactElement {
  const selectSound = screenshot.isFavorite ? 'chirp-event' : 'xp-event';

  const { useInputBinding, useInputPhase, useOnInputPerformed } = likeScreenshotInputAction;

  useOnInputPerformed(favoriteScreenshot, selectSound);

  const binding = useInputBinding();
  const phase = useInputPhase();

  const activeClass =
    phase == 'Performed'
      ? screenshot.isFavorite
        ? styles.menuControlsSectionButtonsButtonFavoriteFavoritedActive
        : styles.menuControlsSectionButtonsButtonActive
      : '';

  return (
    <MenuButtonTooltip
      binding={binding}
      tooltip={
        <LocalizedString
          id={
            screenshot.isFavorite
              ? 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Unfavorite]'
              : screenshot.favoritesCount == 0
                ? 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Favorite Zero]'
                : screenshot.favoritesCount == 1
                  ? 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Favorite Singular]'
                  : 'HallOfFame.UI.Menu.MenuControls.ACTION_TOOLTIP[Favorite Plural]'
          }
          args={{
            // biome-ignore lint/style/useNamingConvention: i18n convention
            NUMBER: <LocalizedNumber value={screenshot.favoritesCount} />,
            // biome-ignore lint/style/useNamingConvention: i18n convention
            FAVORITES_PER_DAY: <LocalizedNumber value={screenshot.favoritesPerDay} />
          }}
        />
      }>
      <MenuButton
        className={`${styles.menuControlsSectionButtonsButton} ${styles.menuControlsSectionButtonsButtonFavorite} ${
          screenshot.isFavorite ? styles.menuControlsSectionButtonsButtonFavoriteFavorited : ''
        } ${activeClass}`}
        src={loveChirperSrc}
        tinted={false}
        onSelect={favoriteScreenshot}
        selectSound={selectSound}
      />
    </MenuButtonTooltip>
  );
}

function MenuControlsError({
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
          style={{
            backgroundImage: 'url(Media/Game/Icons/AdvisorTrafficAccident.svg)'
          }}
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
        {...snappyOnSelect(nextScreenshot)}>
        {translate('HallOfFame.UI.Menu.MenuControls.ACTION[Retry]')}
      </MenuButton>
    </div>
  );
}

function MenuButtonTooltip({
  tooltip,
  binding,
  children
}: Readonly<{
  tooltip: TooltipProps['tooltip'];
  binding: ProxyBinding;
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

function openModSettings(tab: string): void {
  trigger('hallOfFame.common', 'openModSettings', tab);
}

function openSocialLink(modSettings: ModSettings, link: CreatorSocialLink): void {
  const url = modSettings.baseUrl + link.link;

  link.platform == 'paradoxMods' && link.username
    ? trigger('hallOfFame.common', 'openCreatorPage', link.username, url)
    : trigger('hallOfFame.common', 'openWebPage', url);
}

function previousScreenshot(): void {
  trigger('hallOfFame.presenter', 'previousScreenshot');
}

function nextScreenshot(): void {
  trigger('hallOfFame.presenter', 'nextScreenshot');
}

function saveScreenshot(): void {
  trigger('hallOfFame.presenter', 'saveScreenshot');
}

function reportScreenshot(): void {
  trigger('hallOfFame.presenter', 'reportScreenshot');
}

function favoriteScreenshot(): void {
  trigger('hallOfFame.presenter', 'favoriteScreenshot');
}

function locElementToReactNode(
  element: LocElement | null | undefined,
  fallback: ReactNode
): ReactElement {
  return element?.__Type == 'Game.UI.Localization.LocalizedString' ? (
    <LocalizedString id={element.id} fallback={element.value} />
  ) : (
    <>{fallback}</>
  );
}

/**
 * Formats a big number to a human-readable string, applying special formatting
 * rules depending on the number's magnitude.
 */
function formatBigNumber(num: number, translate: Localization['translate']): string {
  let numStr: string;

  if (num < 1000) {
    // No formatting on small numbers.
    numStr = num.toString();
  } else if (num < 10_000) {
    // Formats as "9.9K", precision .1K.
    numStr = `${(num / 1000).toFixed(1)} K`;
  } else if (num < 1_000_000) {
    // Formats as "99K", rounded, precision 1K.
    numStr = `${Math.round(num / 1000)} K`;
  } else {
    // Formats as "9.9M", precision .1M.
    numStr = `${(num / 1_000_000).toFixed(1)} M`;
  }

  return (
    numStr
      // Remove trailing zeros.
      .replace('.0', '')
      // Replace decimal separator.
      // biome-ignore lint/style/noNonNullAssertion: fallback value
      .replace('.', translate('Common.DECIMAL_SEPARATOR', '.')!)
  );
}
