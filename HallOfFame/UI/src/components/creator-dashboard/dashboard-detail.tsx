import classNames from 'classnames';
import { LocalizedNumber, LocalizedString } from 'cs2/l10n';
import { Button, Icon, Scrollable } from 'cs2/ui';
import { type ReactElement, type ReactNode, useState } from 'react';
import type { CreatorStats, DashboardScreenshot, Screenshot } from '../../common';
import apertureSharpSolidSrc from '../../icons/fontawesome/aperture-sharp-solid.svg';
import circleRegularSrc from '../../icons/fontawesome/circle-regular.svg';
import hourglassHalfSolidSrc from '../../icons/fontawesome/hourglass-half-solid.svg';
import naturalResourcesSrc from '../../icons/paradox/natural-resources.svg';
import populationSrc from '../../icons/paradox/population.svg';
import trophySrc from '../../icons/paradox/trophy.svg';
import { formatBigNumber, isPristineWilderness, useImageLoaded, useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import { selectScreenshotDetails } from '../screenshot-details/screenshot-details';
import {
  type DetailsTabId,
  ScreenshotDetailsWindow
} from '../screenshot-details/screenshot-details-window';
import { useDetailsContext } from '../screenshot-details/use-details-context';
import { CardUnderReviewBadge } from './dashboard-card';
import {
  collectionPlace,
  viewersPerLike,
  medalBandIds,
  medalNameIds,
  type MedalState,
  selectMedalState
} from './dashboard-collection';
import { DashboardEditForm } from './dashboard-edit-form';
import { MedalImage } from './dashboard-medal';
import { DashboardError, DashboardLoading } from './dashboard-status';
import { DetailGroup } from './detail-group';
import * as styles from './dashboard-detail.module.scss';

/**
 * One screenshot of the collection, opened from its card, laid out as the card enlarged:
 * the full-size image over a caption holding the city and the medal,
 * then every figure the card and its tooltips hold, each with what it counts,
 * in plain view for a gamepad player.
 * The figures come from the collection's own record, so they show at once,
 * while the full screenshot the rest needs is fetched.
 */
export function DashboardDetail({
  detail,
  screenshot,
  screenshots,
  stats,
  onHasChangesChange
}: Readonly<{
  detail: Exclude<bindings.DashboardDetailState, { status: 'closed' }>;
  screenshot: DashboardScreenshot;
  // The whole collection, to place the screenshot among it.
  screenshots: readonly DashboardScreenshot[];
  stats: CreatorStats;
  // Whether the edit form holds edits.
  onHasChangesChange: (hasChanges: boolean) => void;
}>): ReactElement {
  const medalState = selectMedalState(screenshot, stats);

  const full = detail.status == 'loaded' ? detail.screenshot : undefined;

  // The slideshow's details window, opened from the caption on the tab of the fact chosen.
  const [detailsTab, setDetailsTab] = useState<DetailsTabId>();

  return (
    <div className={styles.detail} data-dashboard-detail={screenshot.id}>
      <Scrollable className={styles.detailMain} trackVisibility='reserve'>
        <div className={styles.detailMainContent}>
          {/* The card enlarged: the image and its caption in one frame. */}
          <div className={styles.print}>
            <DetailImage
              thumbnailUrl={screenshot.imageUrlThumbnail}
              fullUrl={full?.imageUrlFHD ?? null}
              isReported={screenshot.isReported}
            />

            <DetailCaption full={full} medalState={medalState} onOpenDetails={setDetailsTab} />
          </div>

          {screenshot.isReported && <DetailUnderReviewNotice />}

          <DetailFigures
            screenshot={screenshot}
            screenshots={screenshots}
            isRanked={medalState.kind == 'ranked'}
          />
        </div>
      </Scrollable>

      {full && (
        <ScreenshotDetailsWindow
          screenshot={full}
          openTab={detailsTab}
          onClose={() => setDetailsTab(undefined)}
        />
      )}

      <div className={styles.detailSide}>
        {detail.status == 'loading' && <DashboardLoading />}

        {detail.status == 'loaded' && (
          <DashboardEditForm
            key={detail.screenshotId}
            screenshot={detail.screenshot}
            isSaving={detail.isSaving}
            isDeleting={detail.isDeleting}
            onHasChangesChange={onHasChangesChange}
          />
        )}

        {detail.status == 'error' && (
          <DashboardError
            title='HallOfFame.UI.Dashboard.DETAIL_ERROR_TITLE'
            error={detail.error}
            onRetry={() => bindings.openDashboardDetail(detail.screenshotId)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The thumbnail the grid already loaded, scaled up at once,
 * under the full-size image, which fades in over it once loaded.
 */
function DetailImage({
  thumbnailUrl,
  fullUrl,
  isReported
}: Readonly<{
  thumbnailUrl: string;
  fullUrl: string | null;
  isReported: boolean;
}>): ReactElement {
  const isFullLoaded = useImageLoaded(fullUrl);

  return (
    <div className={styles.image}>
      <div className={styles.imageLayer} style={{ backgroundImage: `url(${thumbnailUrl})` }} />

      {fullUrl != null && (
        <div
          className={classNames(styles.imageLayer, styles.imageFull, {
            [styles.imageFullLoaded]: isFullLoaded
          })}
          style={{ backgroundImage: `url(${fullUrl})` }}
        />
      )}

      {isReported && <CardUnderReviewBadge />}
    </div>
  );
}

/**
 * The card badge's tooltip, in plain view.
 */
function DetailUnderReviewNotice(): ReactElement {
  const translate = useTranslate();

  return (
    <div className={styles.notice} data-under-review-notice={true}>
      <Icon src={warningSrc} tinted={true} className={styles.noticeIcon} />

      {translate('HallOfFame.UI.Dashboard.CARD_TOOLTIP[Under Review]')}
    </div>
  );
}

/**
 * The card's caption, enlarged under the image:
 * what the city was, then the medal with what it stands for, at the end as on the card.
 * The city's facts come with the full screenshot, so the caption holds the medal alone until then.
 */
function DetailCaption({
  full,
  medalState,
  onOpenDetails
}: Readonly<{
  full: Screenshot | undefined;
  medalState: MedalState;
  onOpenDetails: (tab: DetailsTabId) => void;
}>): ReactElement {
  const medal = useMedalSummary(medalState);

  return (
    <div className={styles.caption}>
      <div className={styles.captionFacts}>
        {full && <DetailFacts screenshot={full} onOpenDetails={onOpenDetails} />}
      </div>

      <div className={styles.captionMedal} data-medal={medal.name}>
        <div className={styles.captionMedalText}>
          <strong>{medal.title}</strong>

          <div className={styles.captionMedalDescription}>{medal.description}</div>
        </div>

        {medal.icon}
      </div>
    </div>
  );
}

/**
 * The city's milestone and population, as the slideshow labels them, then its map, its playset,
 * and when it was uploaded.
 */
function DetailFacts({
  screenshot,
  onOpenDetails
}: Readonly<{
  screenshot: Screenshot;
  onOpenDetails: (tab: DetailsTabId) => void;
}>): ReactElement {
  const translate = useTranslate();

  // What the details window lists, so each fact opens a tab holding what it counts.
  const { photoModeSettings: photoModeTab, shouldLoadPlayset } = selectScreenshotDetails(
    screenshot,
    useDetailsContext()
  );

  const photoSettingsCount =
    photoModeTab.kind == 'content'
      ? photoModeTab.groups.flatMap(group => group.sections).flatMap(section => section.settings)
          .length
      : 0;

  return (
    <>
      {isPristineWilderness(screenshot) ? (
        <DetailFact iconSrc={naturalResourcesSrc}>
          {translate('HallOfFame.UI.Menu.MenuControls.LABEL[Pristine Wilderness]')}
        </DetailFact>
      ) : (
        <>
          <DetailFact iconSrc={trophySrc}>
            {translate(`Progression.MILESTONE_NAME:${screenshot.cityMilestone}`, '???')}
          </DetailFact>

          <DetailFact iconSrc={populationSrc}>
            {formatBigNumber(screenshot.cityPopulation, translate)}
          </DetailFact>
        </>
      )}

      {screenshot.mapName && <DetailFact iconSrc={mapSrc}>{screenshot.mapName}</DetailFact>}

      {photoSettingsCount > 0 && (
        <DetailFact
          iconSrc={apertureSharpSolidSrc}
          isIconTinted={true}
          name='photoSettings'
          onSelect={() => onOpenDetails('photoModeSettings')}>
          <LocalizedString
            id='HallOfFame.UI.Dashboard.DETAIL_FACT[Photo Settings]'
            args={{ SETTINGS_COUNT: <LocalizedNumber value={photoSettingsCount} /> }}
          />
        </DetailFact>
      )}

      {shouldLoadPlayset && (
        <DetailFact
          iconSrc={paradoxModsSrc}
          name='playset'
          onSelect={() => onOpenDetails('playset')}>
          <LocalizedString
            id='HallOfFame.UI.Dashboard.DETAIL_FACT[Playset]'
            args={{ MODS_COUNT: <LocalizedNumber value={screenshot.paradoxModIds.length} /> }}
          />
        </DetailFact>
      )}

      {/* The exact time, where the band says how long ago. */}
      <DetailFact iconSrc={calendarSrc}>{screenshot.createdAtFormatted}</DetailFact>
    </>
  );
}

/**
 * One fact of the caption, its icon before it, a button when it opens something.
 */
function DetailFact({
  iconSrc,
  isIconTinted = false,
  name,
  onSelect,
  children
}: Readonly<{
  iconSrc: string;
  // A single-colour glyph, painted the text's colour, rather than a coloured image.
  isIconTinted?: boolean;
  name?: string;
  onSelect?: () => void;
  children: ReactNode;
}>): ReactElement {
  // noinspection HtmlRequiredAltAttribute
  const content = (
    <>
      {isIconTinted ? (
        <Icon
          src={iconSrc}
          tinted={true}
          className={classNames(styles.captionIcon, styles.captionIconGlyph)}
        />
      ) : (
        <img src={iconSrc} className={styles.captionIcon} />
      )}
      {children}
    </>
  );

  return (
    <span className={styles.captionFact} data-fact={name}>
      {onSelect ? (
        <Button
          as='div'
          theme={plainButtonTheme}
          className={styles.captionFactButton}
          onSelect={onSelect}>
          {content}
        </Button>
      ) : (
        content
      )}
    </span>
  );
}

/**
 * Each figure beside what it counts, in two framed groups:
 * who saw the screenshot, and how many of them liked it.
 * The like rate shows only on a ranked screenshot, as on the card's tooltip:
 * below the minimums it rests on too few viewers or likes to mean much.
 * The place in the collection shows only beside other screenshots to place it among.
 */
function DetailFigures({
  screenshot,
  screenshots,
  isRanked
}: Readonly<{
  screenshot: DashboardScreenshot;
  screenshots: readonly DashboardScreenshot[];
  isRanked: boolean;
}>): ReactElement {
  return (
    <div className={styles.figures}>
      <DetailGroup
        titleId='HallOfFame.UI.Dashboard.DETAIL_GROUP[Audience]'
        className={styles.figuresGroup}>
        <DetailFigure
          name='uniqueViews'
          value={<LocalizedNumber value={screenshot.uniqueViewsCount} />}
          labelId='HallOfFame.UI.Dashboard.TOTAL[Unique Views]'
          descriptionId='HallOfFame.UI.Dashboard.DETAIL_STAT_DESCRIPTION[Unique Views]'
        />

        <DetailFigure
          name='views'
          value={<LocalizedNumber value={screenshot.viewsCount} />}
          labelId='HallOfFame.UI.Dashboard.TOTAL[Views]'
          descriptionId='HallOfFame.UI.Dashboard.DETAIL_STAT_DESCRIPTION[Views]'
        />

        <DetailFigure
          name='viewerClicks'
          value={<LocalizedNumber value={screenshot.viewerClicksCount} />}
          labelId='HallOfFame.UI.Dashboard.DETAIL_STAT[Viewer Clicks]'
          descriptionId='HallOfFame.UI.Dashboard.DETAIL_STAT_DESCRIPTION[Viewer Clicks]'
        />
      </DetailGroup>

      <DetailGroup
        titleId='HallOfFame.UI.Dashboard.DETAIL_GROUP[Appreciation]'
        className={styles.figuresGroup}>
        <DetailFigure
          name='likes'
          value={<LocalizedNumber value={screenshot.likesCount} />}
          labelId='HallOfFame.UI.Dashboard.TOTAL[Likes]'
          descriptionId='HallOfFame.UI.Dashboard.DETAIL_STAT_DESCRIPTION[Likes]'
        />

        {isRanked && (
          <DetailFigure
            name='likeRate'
            value={
              <LocalizedString
                id='HallOfFame.UI.Dashboard.DETAIL_STAT_VALUE[Like Rate]'
                args={{
                  VIEWERS_COUNT: <LocalizedNumber value={viewersPerLike(screenshot)} />
                }}
              />
            }
            labelId='HallOfFame.UI.Dashboard.DETAIL_STAT[Like Rate]'
            descriptionId='HallOfFame.UI.Dashboard.DETAIL_STAT_DESCRIPTION[Like Rate]'
          />
        )}

        {screenshots.length > 1 && (
          <DetailFigure
            name='collectionPlace'
            value={
              <LocalizedString
                id='HallOfFame.UI.Dashboard.DETAIL_STAT_VALUE[Collection Place]'
                args={{
                  PLACE: <LocalizedNumber value={collectionPlace(screenshot, screenshots)} />
                }}
              />
            }
            labelId='HallOfFame.UI.Dashboard.DETAIL_STAT[Collection Place]'
            descriptionId='HallOfFame.UI.Dashboard.DETAIL_STAT_DESCRIPTION[Collection Place]'
            descriptionArgs={{ SCREENSHOTS_COUNT: <LocalizedNumber value={screenshots.length} /> }}
          />
        )}
      </DetailGroup>
    </div>
  );
}

/**
 * A figure, its value first in a column of its own so the digits line up, then what it counts.
 */
function DetailFigure({
  name,
  value,
  labelId,
  descriptionId,
  descriptionArgs
}: Readonly<{
  name: string;
  value: ReactNode;
  labelId: string;
  descriptionId: string;
  descriptionArgs?: Readonly<Record<string, ReactElement>>;
}>): ReactElement {
  const translate = useTranslate();

  return (
    <div className={styles.figure} data-stat={name}>
      <div className={styles.figureValue}>{value}</div>

      <div className={styles.figureText}>
        <strong>{translate(labelId)}</strong>

        <div className={styles.figureDescription}>
          {descriptionArgs ? (
            <LocalizedString id={descriptionId} args={descriptionArgs} />
          ) : (
            translate(descriptionId)
          )}
        </div>
      </div>
    </div>
  );
}

interface MedalSummary {
  // The medal's tier, or what stands for it in the medal slot of a card.
  readonly name: string;
  readonly icon: ReactNode;
  readonly title: string | null;
  readonly description: ReactNode;
}

/**
 * The medal, or what stands for it while the screenshot has none,
 * with what the card's medal tooltip says of it.
 */
function useMedalSummary(state: MedalState): MedalSummary {
  const translate = useTranslate();

  switch (state.kind) {
    case 'ranked': {
      return {
        name: state.rank,
        icon: <MedalImage rank={state.rank} className={styles.medalImage} hasShimmer={true} />,
        title: translate(medalNameIds[state.rank]),
        // One text node: cohtml lays sibling text nodes out as separate lines.
        description: `${translate(medalBandIds[state.rank]) ?? ''} ${
          translate('HallOfFame.UI.Dashboard.MEDAL_TOOLTIP[Popular]') ?? ''
        }`
      };
    }
    case 'settling': {
      return {
        name: 'settling',
        icon: <Icon src={hourglassHalfSolidSrc} tinted={true} className={styles.medalGlyph} />,
        title: translate('HallOfFame.UI.Dashboard.DETAIL_MEDAL[Settling]'),
        description: (
          <LocalizedString
            id='HallOfFame.UI.Dashboard.MEDAL_TOOLTIP[Settling]'
            args={{ MIN_UNIQUE_VIEWS_COUNT: <LocalizedNumber value={state.minUniqueViewsCount} /> }}
          />
        )
      };
    }
    case 'noMedal': {
      return {
        name: 'none',
        icon: <Icon src={circleRegularSrc} tinted={true} className={styles.medalGlyph} />,
        title: translate('HallOfFame.UI.Dashboard.DETAIL_MEDAL[No Medal]'),
        description: (
          <LocalizedString
            id='HallOfFame.UI.Dashboard.MEDAL_TOOLTIP[No Medal]'
            args={{ MIN_LIKES_COUNT: <LocalizedNumber value={state.minLikesCount} /> }}
          />
        )
      };
    }
    default: {
      // oxlint-disable-next-line typescript/only-throw-error
      throw state satisfies never;
    }
  }
}

const plainButtonTheme = { button: '' };

const warningSrc = 'Media/Glyphs/Warning.svg';

// Full-colour icons of the game's, like the Paradox ones beside them.
const mapSrc = 'Media/Game/Icons/MapTile.svg';

const paradoxModsSrc = 'Media/Glyphs/ParadoxModsCloud.svg';

const calendarSrc = 'Media/Game/Icons/Calendar.svg';
