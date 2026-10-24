import { type Localization, LocalizedString, type LocElement, type LocElementType } from 'cs2/l10n';
import type { ReactElement, ReactNode } from 'react';
import type { Screenshot } from '../../common';

export function locElementToReactNode(
  element: LocElement | null | undefined,
  fallback: ReactNode
): ReactElement {
  // oxlint-disable-next-line no-underscore-dangle typescript/no-unsafe-enum-comparison
  return element?.__Type ==
    ('Game.UI.Localization.LocalizedString' satisfies `${LocElementType}`) ? (
    <LocalizedString id={element.id} fallback={element.value} />
  ) : (
    <>{fallback}</>
  );
}

/**
 * Whether a screenshot shows an empty map rather than a city:
 * likely when the population is 0,
 * and the milestone is 0 (Founding) or 20 (Megalopolis, i.e., creative mode).
 */
export function isPristineWilderness(
  screenshot: Pick<Screenshot, 'cityMilestone' | 'cityPopulation'>
): boolean {
  return (
    screenshot.cityPopulation == 0 &&
    // oxlint-disable-next-line no-magic-numbers
    (screenshot.cityMilestone == 0 || screenshot.cityMilestone == 20)
  );
}

/**
 * Formats a big number to a human-readable string, applying special formatting rules depending on
 * the number's magnitude.
 */
export function formatBigNumber(num: number, translate: Localization['translate']): string {
  let numStr: string;

  if (num < 1000) {
    // No formatting on small numbers.
    numStr = num.toString();
    // oxlint-disable-next-line no-magic-numbers
  } else if (num < 10_000) {
    // Formats as "9.9K", precision .1K.
    numStr = `${(num / 1000).toFixed(1)} K`;
    // oxlint-disable-next-line no-magic-numbers
  } else if (num < 1_000_000) {
    // Formats as "99K", rounded, precision 1K.
    numStr = `${Math.round(num / 1000)} K`;
  } else {
    // Formats as "9.9M", precision .1M.
    // oxlint-disable-next-line no-magic-numbers
    numStr = `${(num / 1_000_000).toFixed(1)} M`;
  }

  return (
    numStr
      // Remove trailing zeros.
      .replace('.0', '')
      // Replace decimal separator.
      // oxlint-disable-next-line typescript/no-non-null-assertion - fallback '.' means non-null
      .replace('.', translate('Common.DECIMAL_SEPARATOR', '.')!)
  );
}
