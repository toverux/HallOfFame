import { LocalizedString } from 'cs2/l10n';
import { Button, Icon } from 'cs2/ui';
import { type CSSProperties, memo, type ReactElement, useState } from 'react';
import { type Screenshot, supportedSocialPlatforms } from '../../common';
import { Tooltip } from '../../components/tooltip';
import translateSrc from '../../icons/translate.svg';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { selectLocalizedName } from './select-localized-name';
import { socialPlatforms } from './social-platforms';
import { MenuControlsViewerLink } from './viewer-link';
import * as styles from './city-name.module.scss';

/**
 * The translated-names hint's glyph, for the preloading the controls do on its behalf.
 *
 * The hint only appears on a screenshot whose names were translated, so the first one to come up in
 * the slideshow would otherwise fetch it on the frame it is meant to be drawn.
 */
// oxlint-disable-next-line react/only-export-components - no Fast Refresh in a Cohtml bundle
export const cityNamePreloadedIcons: readonly string[] = [translateSrc];

export const MenuControlsCityName = memo(
  ({
    screenshot
  }: Readonly<{
    screenshot: Screenshot;
  }>): ReactElement | null => {
    const translate = useTranslate();

    const gameLocale = bindings.useLocale();

    const modSettings = bindings.useModSettings();

    const [showTranslations, setShowTranslations] = useState(false);

    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const city = selectLocalizedName(modSettings.namesTranslationMode, gameLocale, {
      value: screenshot.cityName,
      latinized: screenshot.cityNameLatinized,
      translated: screenshot.cityNameTranslated,
      locale: screenshot.cityNameLocale
    });

    const creator = selectLocalizedName(modSettings.namesTranslationMode, gameLocale, {
      value: screenshot.creator.creatorName ?? '',
      latinized: screenshot.creator.creatorNameLatinized,
      translated: screenshot.creator.creatorNameTranslated,
      locale: screenshot.creator.creatorNameLocale
    });

    // oxlint-disable-next-line typescript/prefer-nullish-coalescing - empty '' must fall through
    const creatorName = creator.name || 'anonymous';

    const supportedSocials = modSettings.showCreatorSocials
      ? screenshot.creator.socials
          .filter(link => supportedSocialPlatforms.includes(link.platform))
          .sort(
            (a, b) =>
              supportedSocialPlatforms.indexOf(a.platform) -
              supportedSocialPlatforms.indexOf(b.platform)
          )
      : [];

    return (
      <div className={styles.names}>
        {(city.isTranslated || creator.isTranslated) && (
          <div
            className={styles.namesTranslatedHint}
            onMouseEnter={() => setShowTranslations(true)}
            onMouseLeave={() => setShowTranslations(false)}>
            <Icon src={translateSrc} className={styles.namesTranslatedHintIcon} />
            {translate('HallOfFame.UI.Menu.MenuControls.TRANSLATED')}
          </div>
        )}

        <div className={styles.namesCity}>
          <Tooltip
            direction='right'
            disabled={!city.isTranslated || isMenuOpen}
            forceVisible={showTranslations}
            tooltip={
              <div className={styles.namesTranslatedTooltip}>
                <strong>{screenshot.cityName}</strong>
                {city.alternate}
              </div>
            }>
            {/*
              The tooltip anchors to this wrapper, not to the link inside it. Both want to own the
              same element's DOM handle, and opening the menu re-resolves it, which would strip the
              tooltip's listeners off the element for good.
            */}
            <span>
              <MenuControlsViewerLink
                key={screenshot.id}
                trackedUrl={screenshot.viewerUrl}
                shareUrl={screenshot.viewerShareUrl}
                onToggle={setIsMenuOpen}>
                {city.name}
              </MenuControlsViewerLink>
            </span>
          </Tooltip>
        </div>

        <div className={styles.namesCreator}>
          <Tooltip
            direction='down'
            disabled={!creator.isTranslated || isMenuOpen}
            forceVisible={showTranslations}
            tooltip={
              <div className={styles.namesTranslatedTooltip}>
                <strong>{screenshot.creator.creatorName}</strong>
                {creator.alternate}
              </div>
            }>
            {/*
              The whole "by …" phrase is the link, rather than the name alone. Cohtml lays every
              element out as a box and never fragments one across line boxes, so a name wrapped in
              its own element becomes a box starting mid-sentence: a long name would wrap within
              that box instead of back to the phrase's left margin, and the social icons would stop
              trailing it.
            */}
            <span className={styles.namesCreatorBy}>
              <MenuControlsViewerLink
                key={screenshot.id}
                trackedUrl={screenshot.creator.viewerUrl}
                shareUrl={screenshot.creator.viewerShareUrl}
                onToggle={setIsMenuOpen}>
                <LocalizedString
                  id='HallOfFame.Common.CITY_BY'
                  args={{ CREATOR_NAME: creatorName }}
                />
              </MenuControlsViewerLink>
            </span>
          </Tooltip>

          {modSettings.showCreatorSocials && (
            <div className={styles.namesCreatorSocials}>
              {supportedSocials.map(link => (
                <Tooltip
                  key={link.platform}
                  tooltip={
                    <LocalizedString
                      id='HallOfFame.UI.Menu.MenuControls.FIND_CREATOR_X_ON_Y_TOOLTIP'
                      args={{
                        CREATOR_NAME: creatorName,
                        SOCIAL_PLATFORM: socialPlatforms[link.platform].name
                      }}
                    />
                  }
                  direction='down'>
                  <Button
                    className={styles.namesCreatorSocialsButton}
                    variant='round'
                    tinted={true}
                    src={socialPlatforms[link.platform].logo}
                    style={
                      { '--brand-color': socialPlatforms[link.platform].color } as CSSProperties
                    }
                    onSelect={() => bindings.openSocialLink(link)}
                  />
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);
