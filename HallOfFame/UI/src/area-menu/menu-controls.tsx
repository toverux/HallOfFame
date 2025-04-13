import { trigger } from 'cs2/api';
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
  {
    logo: string;
    color: string;
  }
> = {
  paradoxMods: { logo: 'Media/Glyphs/ParadoxMods.svg', color: '#5abe41' },
  discordServer: { logo: discordBrandsSolid, color: '#5865F2' },
  reddit: { logo: redditBrandsSolid, color: '#FF4500' },
  twitch: { logo: twitchBrandsSolid, color: '#8956FB' },
  youtube: { logo: youtubeBrandsSolid, color: '#FF0000' }
};

const socialPlatformsOrder: readonly CreatorSocialLink['platform'][] = [
  'paradoxMods',
  'youtube',
  'twitch',
  'discordServer',
  'reddit'
];

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

function MenuControlsCityName({
  screenshot
}: Readonly<{
  screenshot: Screenshot;
}>): ReactElement | null {
  const modSettings = useModSettings();

  if (!screenshot.creator) {
    // This will not happen - unless we have a broken ObjectId reference.
    console.warn(`HoF: No creator information for screenshot ${screenshot.id}`);

    return null;
  }

  const supportedSocials = screenshot.creator.social
    .filter(link => link.platform in socialPlatforms)
    .sort(
      (a, b) => socialPlatformsOrder.indexOf(a.platform) - socialPlatformsOrder.indexOf(b.platform)
    );

  return (
    <div className={styles.menuControlsNames}>
      <div className={styles.menuControlsNamesCity}>{screenshot.cityName}</div>

      <div className={styles.menuControlsNamesCreator}>
        <LocalizedString
          id='HallOfFame.Common.CITY_BY'
          fallback={'by {CREATOR_NAME}'}
          args={{
            // biome-ignore lint/style/useNamingConvention: i18n convention
            CREATOR_NAME: screenshot.creator.creatorName ?? ''
          }}
        />

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

  // Do not show the pop/milestone labels if this is an empty map screenshot,
  // which is likely when the pop is 0 and the milestone is 0 (Founding) or 20
  // (Megalopolis, i.e. creative mode).
  const isPristineWilderness =
    screenshot.cityPopulation == 0 &&
    (screenshot.cityMilestone == 0 || screenshot.cityMilestone == 20);

  // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
  return (
    <div className={styles.menuControlsSectionScreenshotLabels}>
      {isPristineWilderness ? (
        <span>
          <img src='Media/Game/Icons/NaturalResources.svg' />
          {translate(
            `HallOfFame.UI.Menu.MenuControls.LABEL[Pristine Wilderness]`,
            `Pristine wilderness`
          )}
        </span>
      ) : (
        <>
          <span>
            <img src='Media/Game/Icons/Trophy.svg' />
            {translate(`Progression.MILESTONE_NAME:${screenshot.cityMilestone}`, `???`)}
          </span>

          <span>
            <img src='Media/Game/Icons/Population.svg' />
            {formatBigNumber(screenshot.cityPopulation, translate)}
          </span>
        </>
      )}

      {modSettings.showViewCount && (
        <Tooltip
          tooltip={
            <LocalizedString
              id='HallOfFame.UI.Menu.MenuControls.LABEL_TOOLTIP[Views]'
              fallback='{NUMBER} views ({VIEWS_PER_DAY} views/day)'
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
    // setTimeout is used to give time to the key press .*active class to
    // show briefly before [disabled] is set.
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
    // setTimeout is used to give time to the key press .*active class to
    // show briefly before [disabled] is set.
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
          fallback={screenshot.isFavorite ? 'Unfavorite this image' : 'Favorite this image'}
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
