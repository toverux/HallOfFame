import { LocalizedNumber, LocalizedString } from 'cs2/l10n';
import { memo, type ReactElement, type ReactNode } from 'react';
import type { Screenshot } from '../../common';
import { Tooltip } from '../../components/tooltip';
import naturalResourcesSrc from '../../icons/paradox/natural-resources.svg';
import populationSrc from '../../icons/paradox/population.svg';
import trophySrc from '../../icons/paradox/trophy.svg';
import eyeOpenSrc from '../../icons/uil/eye-open.svg';
import { useTranslate } from '../../utils';
import type * as bindings from '../../utils/bindings';
import { formatBigNumber, isPristineWilderness } from './menu-controls-utils';
import * as styles from './screenshot-labels.module.scss';

export const MenuControlsScreenshotLabels = memo(
  ({
    modSettings,
    screenshot,
    children
  }: Readonly<{
    modSettings: bindings.ModSettings;
    screenshot: Screenshot;
    /**
     * Pills placed after the labels, wrapping along with them.
     */
    children?: ReactNode;
  }>): ReactElement => {
    const translate = useTranslate();

    // noinspection HtmlUnknownTarget,HtmlRequiredAltAttribute
    return (
      <div className={styles.labels}>
        {modSettings.showCityInfo &&
          (isPristineWilderness(screenshot) ? (
            <span className={styles.labelsLabel}>
              <img src={naturalResourcesSrc} className={styles.labelsIcon} />
              {translate(`HallOfFame.UI.Menu.MenuControls.LABEL[Pristine Wilderness]`)}
            </span>
          ) : (
            <>
              <span className={styles.labelsLabel}>
                <img src={trophySrc} className={styles.labelsIcon} />
                {translate(`Progression.MILESTONE_NAME:${screenshot.cityMilestone}`, `???`)}
              </span>

              <span className={styles.labelsLabel}>
                <img src={populationSrc} className={styles.labelsIcon} />
                {formatBigNumber(screenshot.cityPopulation, translate)}
              </span>
            </>
          ))}

        {modSettings.showViewCount && (
          <Tooltip
            tooltip={
              <LocalizedString
                id='HallOfFame.UI.Menu.MenuControls.LABEL_TOOLTIP[Views]'
                args={{
                  VIEWS_COUNT: <LocalizedNumber value={screenshot.viewsCount} />,
                  UNIQUE_VIEWS_COUNT: <LocalizedNumber value={screenshot.uniqueViewsCount} />
                }}
              />
            }>
            <span className={styles.labelsLabel}>
              <img src={eyeOpenSrc} className={styles.labelsIcon} />
              {formatBigNumber(screenshot.uniqueViewsCount, translate)}
            </span>
          </Tooltip>
        )}

        <Tooltip tooltip={screenshot.createdAtFormatted}>
          <span className={styles.labelsLabel}>{screenshot.createdAtFormattedDistance}</span>
        </Tooltip>

        {children}
      </div>
    );
  }
);
