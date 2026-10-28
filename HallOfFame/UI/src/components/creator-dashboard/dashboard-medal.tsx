import classNames from 'classnames';
import type { CSSProperties, PropsWithChildren, ReactElement, ReactNode } from 'react';
import type { ScreenshotRank } from '../../common';
import bronzeSrc from '../../icons/medals/bronze.svg';
import diamondSrc from '../../icons/medals/diamond.svg';
import goldSrc from '../../icons/medals/gold.svg';
import platinumSrc from '../../icons/medals/platinum.svg';
import silverSrc from '../../icons/medals/silver.svg';
import { useTranslate } from '../../utils';
import { medalBandIds, medalNameIds } from './dashboard-collection';
import * as styles from './dashboard-medal.module.scss';

/**
 * A medal's image, the diamond's with a glint sweeping over it where `hasShimmer` asks for one:
 * on a card, where the medal is the card's reward,
 * and not in the band, where it would pull the eye from the count beside it.
 */
export function MedalImage({
  rank,
  className,
  hasShimmer = false
}: Readonly<{
  rank: ScreenshotRank;
  className: string | undefined;
  hasShimmer?: boolean;
}>): ReactElement {
  if (rank != 'diamond' || !hasShimmer) {
    // noinspection HtmlRequiredAltAttribute
    return <img src={medalSrcs[rank]} className={className} />;
  }

  return (
    <div className={classNames(styles.diamond, className)}>
      {/* noinspection HtmlRequiredAltAttribute */}
      <img src={diamondSrc} className={styles.diamondImage} />

      <div className={styles.diamondGlint} style={diamondGlintStyle} />
    </div>
  );
}

/**
 * What a medal stands for, shown over a card's medal and over the header's count of it.
 */
export function MedalTooltip({ rank }: Readonly<{ rank: ScreenshotRank }>): ReactElement {
  const translate = useTranslate();

  return (
    <div className={styles.medalTooltip}>
      <strong>{translate(medalNameIds[rank])}</strong>

      <div>{translate(medalBandIds[rank])}</div>

      <div className={styles.medalTooltipPopular}>
        {translate('HallOfFame.UI.Dashboard.MEDAL_TOOLTIP[Popular]')}
      </div>
    </div>
  );
}

/**
 * What a card without a medal stands for, under a title as a medal's tooltip has one.
 */
export function UnrankedTooltip({
  title,
  children
}: Readonly<PropsWithChildren<{ title: ReactNode }>>): ReactElement {
  return (
    <div className={styles.medalTooltip}>
      <strong>{title}</strong>

      <div>{children}</div>
    </div>
  );
}

// The glint's silhouette: the diamond's own image, as a mask.
const diamondGlintStyle: CSSProperties = { maskImage: `url(${diamondSrc})` };

const medalSrcs: Readonly<Record<ScreenshotRank, string>> = {
  bronze: bronzeSrc,
  silver: silverSrc,
  gold: goldSrc,
  platinum: platinumSrc,
  diamond: diamondSrc
};
