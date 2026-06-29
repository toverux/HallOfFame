import classNames from 'classnames';
import { LocalizedNumber, LocalizedString, useLocalization } from 'cs2/l10n';
import { memo, type ReactElement } from 'react';
// biome-ignore-start lint/correctness/noPrivateImports: svgs don't have @public annotations
import populationSrc from '../../icons/paradox/population.svg';
import trophySrc from '../../icons/paradox/trophy.svg';
import * as bindings from '../../utils/bindings';
// biome-ignore-end lint/correctness/noPrivateImports: svgs don't have @public annotations
import * as styles from './panel-city-info.module.scss';
import * as shared from './shared.module.scss';

export const ScreenshotUploadPanelContentCityInfo = memo(
  function ScreenshotUploadPanelContentCityInfoBase({
    settings,
    screenshotSnapshot,
    creatorNameIsEmpty
  }: Readonly<{
    settings: bindings.ModSettings;
    screenshotSnapshot: bindings.JsonScreenshotSnapshot;
    creatorNameIsEmpty: boolean;
  }>): ReactElement {
    const { translate } = useLocalization();

    const cityName =
      bindings.useCityName() ||
      // biome-ignore lint/style/noNonNullAssertion: translation controlled by us.
      translate('HallOfFame.Common.DEFAULT_CITY_NAME')!;

    // noinspection HtmlRequiredAltAttribute
    return (
      <div className={classNames(styles.cityInfo, shared.panelSurface)}>
        <span className={styles.cityInfoName}>
          <strong>{cityName}</strong>
          {!creatorNameIsEmpty && (
            <LocalizedString
              id='HallOfFame.Common.CITY_BY'
              // biome-ignore lint/style/useNamingConvention: i18n convention
              args={{ CREATOR_NAME: settings.creatorName }}
            />
          )}
        </span>

        <div style={{ flex: 1 }} />

        <span>
          <img src={trophySrc} />
          {translate(`Progression.MILESTONE_NAME:${screenshotSnapshot.achievedMilestone}`)}
        </span>

        <span>
          <img src={populationSrc} />
          <LocalizedNumber value={screenshotSnapshot.population} />
        </span>
      </div>
    );
  }
);
