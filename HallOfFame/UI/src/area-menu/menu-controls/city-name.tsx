import { LocalizedString, useLocalization } from 'cs2/l10n';
import { Button, Tooltip } from 'cs2/ui';
import { type CSSProperties, memo, type ReactElement, useState } from 'react';
import * as bindings from '../../bindings';
import { type CreatorSocialLink, type Screenshot, supportedSocialPlatforms } from '../../common';
// biome-ignore-start lint/correctness/noPrivateImports: svgs don't have @public annotations
import discordBrandsSolid from '../../icons/fontawesome/discord-brands-solid.svg';
import twitchBrandsSolid from '../../icons/fontawesome/twitch-brands-solid.svg';
import youtubeBrandsSolid from '../../icons/fontawesome/youtube-brands-solid.svg';
// biome-ignore-end lint/correctness/noPrivateImports: svgs don't have @public annotations
import * as styles from './menu-controls.module.scss';

const socialPlatforms: {
  [K in CreatorSocialLink['platform']]: Readonly<{ name: string; logo: string; color: string }>;
} = {
  discord: { name: 'Discord', logo: discordBrandsSolid, color: '#5865F2' },
  paradoxmods: { name: 'Paradox Mods', logo: 'Media/Glyphs/ParadoxMods.svg', color: '#5abe41' },
  twitch: { name: 'Twitch', logo: twitchBrandsSolid, color: '#8956FB' },
  youtube: { name: 'YouTube', logo: youtubeBrandsSolid, color: '#FF0000' }
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: that's okay, but yeah.
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: splitting would make it too complex.
export const MenuControlsCityName = memo(function MenuControlsCityNameBase({
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
