import classNames from 'classnames';
import { bindValue, trigger, useValue } from 'cs2/api';
import { ControlIcons } from 'cs2/input';
import {
  type Localization,
  LocalizedNumber,
  LocalizedString,
  type LocElement,
  useLocalization
} from 'cs2/l10n';
import { Button, MenuButton, Tooltip, type TooltipProps, type UISound } from 'cs2/ui';
import { type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { type CreatorSocialLink, type Screenshot, supportedSocialPlatforms } from '../common';
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
import {
  bindInputAction,
  type InputActionPhase,
  type ModSettings,
  type ProxyBinding,
  playSound,
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
    // biome-ignore lint/complexity/noUselessFragments: we need to return a ReactElement.
    return <></>;
  }

  return (
    <div
      className={classNames(styles.menuControls, styles.menuControlsApplyButtonsOffset)}
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
          <MenuControlsLikeButton screenshot={menuState.screenshot} />
        </div>

        <div
          className={classNames(styles.menuControlsSectionContent, styles.menuControlsLikesCount)}>
          <span className={styles.menuControlsLikesCountNumber}>
            {menuState.screenshot.likesCount < 1000
              ? menuState.screenshot.likesCount
              : `${(menuState.screenshot.likesCount / 1000).toFixed(1)} k`}
          </span>
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
            onSelect={() => setShowOtherActions(!showMoreActions)}
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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: that's okay, but yeah.
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: splitting would make it too complex.
function MenuControlsCityName({
  screenshot
}: Readonly<{
  screenshot: Screenshot;
}>): ReactElement | null {
  const { translate } = useLocalization();

  const gameLocale = useValue(locale$);

  const modSettings = useModSettings();

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
                  // @ts-expect-error
                  style={{ '--brand-color': socialPlatforms[link.platform].color }}
                  onSelect={() => openSocialLink(link)}
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
}

function MenuControlsNextButton({
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
    () => !disabled && (setTimeout(nextScreenshot), true),
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

  const { useInputBinding, useInputPhase } = previousScreenshotInputAction;

  const binding = useInputBinding();
  const phase = useInputPhase();

  useMenuControlsInputAction(
    phase,
    // setTimeout is used to give time to the key press .*active class to show briefly before
    // [disabled] is set.
    () => !disabled && (setTimeout(previousScreenshot), true),
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

function MenuControlsLikeButton({
  screenshot
}: Readonly<{
  screenshot: Screenshot;
}>): ReactElement {
  const selectSound = screenshot.isLiked ? 'chirp-event' : 'xp-event';

  const { useInputBinding, useInputPhase } = likeScreenshotInputAction;

  const binding = useInputBinding();
  const phase = useInputPhase();

  useMenuControlsInputAction(phase, likeScreenshot, selectSound);

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
        onSelect={likeScreenshot}
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

/**
 * Triggers the {@link handler} when the input is executed (key down AND key up).
 * The handler returns a boolean indicating whether the handler has executed the action (was ready
 * to do so).
 * If the handler returns `false`, it will be called again on key up.
 * Returning void (`undefined`) is equivalent to returning `true`.
 *
 * This is a very specific implementation whose sole role is to provide a good UX for the behavior
 * of the main menu control buttons.
 *
 * @param phase   The current input action phase.
 * @param handler The function to call when the input action is performed (key down) AND canceled
 *                (key up).
 * @param sound   The sound to play when the handler returned `true`.
 */
function useMenuControlsInputAction(
  phase: InputActionPhase,
  // biome-ignore lint/suspicious/noConfusingVoidType: it's really how I want it to be here.
  handler: () => boolean | undefined | void,
  sound?: `${UISound}`
) {
  const [replayOnCanceled, setReplayOnCanceled] = useState(false);

  useEffect(() => {
    // Performed = keydown
    // Canceled = keyup
    if (phase == 'Performed' || (phase == 'Canceled' && replayOnCanceled)) {
      const ready = handler() ?? true;

      setReplayOnCanceled(phase == 'Performed' && !ready);

      if (ready && sound) {
        playSound(sound);
      }
    }
  }, [phase]);
}

function openModSettings(tab: string): void {
  trigger('hallOfFame.common', 'openModSettings', tab);
}

function openSocialLink({ platform, link }: CreatorSocialLink): void {
  platform == 'paradoxmods'
    ? trigger('hallOfFame.common', 'openCreatorPage', link)
    : trigger('hallOfFame.common', 'openWebPage', link);
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

function likeScreenshot(): void {
  trigger('hallOfFame.presenter', 'likeScreenshot');
}

function locElementToReactNode(
  element: LocElement | null | undefined,
  fallback: ReactNode
): ReactElement {
  return element?.__Type == 'Game.UI.Localization.LocalizedString' ? (
    <LocalizedString id={element.id} fallback={element.value} />
  ) : (
    // biome-ignore lint/complexity/noUselessFragments: we need to return a ReactElement.
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
