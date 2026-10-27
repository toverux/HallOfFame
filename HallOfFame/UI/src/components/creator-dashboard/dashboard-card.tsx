import classNames from 'classnames';
import { LocalizedNumber, LocalizedString } from 'cs2/l10n';
import { Button, Icon } from 'cs2/ui';
import { memo, type ReactElement } from 'react';
import type { CreatorStats, DashboardScreenshot } from '../../common';
import hourglassHalfSolidSrc from '../../icons/fontawesome/hourglass-half-solid.svg';
import { useImageLoaded, useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { Tooltip } from '../tooltip';
import { type MedalState, selectMedalState, viewersPerLike } from './dashboard-collection';
import { MedalImage, MedalTooltip } from './dashboard-medal';
import { useCityName } from './use-city-name';
import * as styles from './dashboard-card.module.scss';

/**
 * One screenshot of the collection: its thumbnail,
 * what tells it apart from the creator's other shots of the same city,
 * the attention it got, and its medal.
 * Selecting it opens its detail view.
 */
export const DashboardCard = memo(
  ({
    screenshot,
    stats
  }: Readonly<{
    screenshot: DashboardScreenshot;
    stats: CreatorStats;
  }>): ReactElement => {
    const cityName = useCityName(screenshot);

    const medalState = selectMedalState(screenshot, stats);

    const isThumbnailLoaded = useImageLoaded(screenshot.imageUrlThumbnail);

    return (
      <Button
        as='div'
        theme={plainButtonTheme}
        className={styles.card}
        onSelect={() => bindings.openDashboardDetail(screenshot.id)}
        data-dashboard-card={screenshot.id}>
        <div className={styles.cardThumbnail}>
          <div
            className={classNames(
              styles.cardThumbnailImage,
              isThumbnailLoaded && styles.cardThumbnailImageLoaded
            )}
            style={{ backgroundImage: `url(${screenshot.imageUrlThumbnail})` }}
          />

          {screenshot.isReported && <CardUnderReviewBadge />}
        </div>

        <div className={styles.cardInfo}>
          <div className={styles.cardText}>
            <div className={styles.cardCityName}>{cityName}</div>

            <Tooltip
              direction='down'
              tooltip={
                <CardStatsTooltip screenshot={screenshot} isRanked={medalState.kind == 'ranked'} />
              }>
              <div className={styles.cardStats} data-card-stats={true}>
                <span className={styles.cardStat}>
                  <Icon src={eyeOpenSrc} tinted={true} className={styles.cardStatIcon} />
                  <LocalizedNumber value={screenshot.uniqueViewsCount} />
                </span>

                <span className={styles.cardStat}>
                  <Icon src={heartFilledSrc} tinted={true} className={styles.cardStatIcon} />
                  <LocalizedNumber value={screenshot.likesCount} />
                </span>
              </div>
            </Tooltip>

            {/* How long ago, the exact date under the cursor. */}
            <Tooltip tooltip={screenshot.createdAtFormatted}>
              <div className={styles.cardDate}>{screenshot.createdAtFormattedDistance}</div>
            </Tooltip>
          </div>

          <CardMedal state={medalState} />
        </div>
      </Button>
    );
  }
);

/**
 * Reported screenshots stay in the collection,
 * hidden from the slideshow until a moderator clears them, which is all the badge has to explain.
 * The detail view lays it over its image too.
 */
export function CardUnderReviewBadge(): ReactElement {
  const translate = useTranslate();

  return (
    <Tooltip
      direction='down'
      tooltip={translate('HallOfFame.UI.Dashboard.CARD_TOOLTIP[Under Review]')}>
      <div className={styles.cardUnderReview} data-under-review={true}>
        <Icon src={warningSrc} tinted={true} className={styles.cardUnderReviewIcon} />
        {translate('HallOfFame.UI.Dashboard.CARD[Under Review]')}
      </div>
    </Tooltip>
  );
}

/**
 * The figures the card leaves out.
 * The like rate only shows on a ranked screenshot:
 * below the minimums it rests on too few viewers or likes to mean much,
 * and a raw percentage reads worse than it is.
 * The rate shown is {@link viewersPerLike}, the ratio the medal ranks by, as "1 in N" viewers.
 */
function CardStatsTooltip({
  screenshot,
  isRanked
}: Readonly<{
  screenshot: DashboardScreenshot;
  isRanked: boolean;
}>): ReactElement {
  return (
    <div className={styles.cardStatsTooltip}>
      <LocalizedString
        id='HallOfFame.UI.Dashboard.CARD_TOOLTIP[Views]'
        args={{
          VIEWS_COUNT: <LocalizedNumber value={screenshot.viewsCount} />,
          UNIQUE_VIEWS_COUNT: <LocalizedNumber value={screenshot.uniqueViewsCount} />
        }}
      />

      <LocalizedString
        id='HallOfFame.UI.Dashboard.CARD_TOOLTIP[Viewer Clicks]'
        args={{ VIEWER_CLICKS_COUNT: <LocalizedNumber value={screenshot.viewerClicksCount} /> }}
      />

      {isRanked && (
        <LocalizedString
          id='HallOfFame.UI.Dashboard.CARD_TOOLTIP[Like Rate]'
          args={{
            VIEWERS_COUNT: <LocalizedNumber value={viewersPerLike(screenshot)} />
          }}
        />
      )}
    </div>
  );
}

/**
 * The medal, or what stands in its slot while the screenshot has none:
 * Settling's progress towards its first ranking,
 * or nothing at all for No medal, which is no failure to point at.
 */
function CardMedal({ state }: Readonly<{ state: MedalState }>): ReactElement {
  switch (state.kind) {
    case 'ranked': {
      return (
        <Tooltip direction='down' tooltip={<MedalTooltip rank={state.rank} />}>
          <div className={styles.cardMedal} data-medal={state.rank}>
            <MedalImage rank={state.rank} className={styles.cardMedalImage} hasShimmer={true} />
          </div>
        </Tooltip>
      );
    }
    case 'settling': {
      return (
        <Tooltip
          direction='down'
          tooltip={
            <LocalizedString
              id='HallOfFame.UI.Dashboard.MEDAL_TOOLTIP[Settling]'
              args={{
                MIN_UNIQUE_VIEWS_COUNT: <LocalizedNumber value={state.minUniqueViewsCount} />
              }}
            />
          }>
          <div className={styles.cardMedal} data-medal='settling'>
            <Icon src={hourglassHalfSolidSrc} tinted={true} className={styles.cardMedalSettling} />

            <div className={styles.cardMedalProgress}>
              <LocalizedString
                id='HallOfFame.UI.Dashboard.CARD[Settling Progress]'
                args={{
                  UNIQUE_VIEWS_COUNT: <LocalizedNumber value={state.uniqueViewsCount} />,
                  MIN_UNIQUE_VIEWS_COUNT: <LocalizedNumber value={state.minUniqueViewsCount} />
                }}
              />
            </div>
          </div>
        </Tooltip>
      );
    }
    case 'noMedal': {
      // The slot stays empty, but still answers a hover: a creator wondering why a screenshot has
      // no medal looks right there.
      return (
        <Tooltip
          direction='down'
          tooltip={
            <LocalizedString
              id='HallOfFame.UI.Dashboard.MEDAL_TOOLTIP[No Medal]'
              args={{ MIN_LIKES_COUNT: <LocalizedNumber value={state.minLikesCount} /> }}
            />
          }>
          <div className={styles.cardMedal} data-medal='none' />
        </Tooltip>
      );
    }
    default: {
      // oxlint-disable-next-line typescript/only-throw-error
      throw state satisfies never;
    }
  }
}

// The card paints its own face, the vanilla button's.
const plainButtonTheme = { button: '' };

const eyeOpenSrc = 'Media/Glyphs/EyeOpen.svg';

const heartFilledSrc = 'Media/Glyphs/HeartFilled.svg';

const warningSrc = 'Media/Glyphs/Warning.svg';
