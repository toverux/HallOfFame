import { selectLocalizedName } from '../../area-menu/menu-controls/select-localized-name';
import type { DashboardScreenshot } from '../../common';
import * as bindings from '../../utils/bindings';

/**
 * The form of a screenshot's city name the slideshow shows,
 * or the native one when that form is missing.
 */
export function useCityName(screenshot: DashboardScreenshot): string {
  const modSettings = bindings.useModSettings();

  const gameLocale = bindings.useLocale();

  const city = selectLocalizedName(modSettings.namesTranslationMode, gameLocale, {
    value: screenshot.cityName,
    latinized: screenshot.cityNameLatinized,
    translated: screenshot.cityNameTranslated,
    locale: screenshot.cityNameLocale
  });

  return city.name ?? screenshot.cityName;
}
