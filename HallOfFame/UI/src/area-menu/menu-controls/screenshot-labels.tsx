import { LocalizedNumber, LocalizedString, useLocalization } from 'cs2/l10n';
import { Tooltip } from 'cs2/ui';
import { memo, type ReactElement } from 'react';
import type { Screenshot } from '../../common';
// biome-ignore-start lint/correctness/noPrivateImports: svgs don't have @public annotations
import naturalResourcesSrc from '../../icons/paradox/natural-resources.svg';
import populationSrc from '../../icons/paradox/population.svg';
import trophySrc from '../../icons/paradox/trophy.svg';
import eyeOpenSrc from '../../icons/uil/colored/eye-open.svg';
// biome-ignore-end lint/correctness/noPrivateImports: svgs don't have @public annotations
import type * as bindings from '../../utils/bindings';
import { formatBigNumber } from './menu-controls-utils';
import * as styles from './screenshot-labels.module.scss';

export const MenuControlsScreenshotLabels = memo(function MenuControlsScreenshotLabelsBase({
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
    <div className={styles.labels}>
      {isPristineWilderness ? (
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
          <span className={styles.labelsLabel}>
            <img src={eyeOpenSrc} className={styles.labelsIcon} />
            {formatBigNumber(screenshot.uniqueViewsCount, translate)}
          </span>
        </Tooltip>
      )}

      <Tooltip tooltip={screenshot.createdAtFormatted}>
        <span className={styles.labelsLabel}>{screenshot.createdAtFormattedDistance}</span>
      </Tooltip>
    </div>
  );
});
