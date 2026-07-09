import classNames from 'classnames';
import { LocalizedNumber, LocalizedString } from 'cs2/l10n';
import { memo, type ReactElement } from 'react';
import populationSrc from '../../icons/paradox/population.svg';
import trophySrc from '../../icons/paradox/trophy.svg';
import { useTranslate } from '../../utils';
import * as bindings from '../../utils/bindings';
import * as styles from './panel-city-info.module.scss';
import * as shared from './shared.module.scss';

export const ScreenshotUploadPanelContentCityInfo = memo(
  ({
    settings,
    screenshotSnapshot,
    creatorNameIsEmpty
  }: Readonly<{
    settings: bindings.ModSettings;
    screenshotSnapshot: bindings.JsonScreenshotSnapshot;
    creatorNameIsEmpty: boolean;
  }>): ReactElement => {
    const translate = useTranslate();

    // oxlint-disable-next-line typescript/no-non-null-assertion - default city name key always resolves
    const cityName = bindings.useCityName() || translate('HallOfFame.Common.DEFAULT_CITY_NAME')!;

    // noinspection HtmlRequiredAltAttribute
    return (
      <div className={classNames(styles.cityInfo, shared.panelSurface)}>
        <span className={styles.cityInfoName}>
          <strong>{cityName}</strong>
          {!creatorNameIsEmpty && (
            <LocalizedString
              id='HallOfFame.Common.CITY_BY'
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
