import { type Localization, useLocalization } from 'cs2/l10n';

/**
 * Returns the game's `translate` function from `useLocalization()`.
 *
 * `cs2/l10n` declares `Localization.translate` method-style, so destructuring it directly trips
 * `typescript/unbound-method` at every call site (14 across the mod).
 * This hook centralizes that safe destructure behind a single suppression and hands back the plain
 * bound function, so components can `const translate = useTranslate()` without the false positive.
 */
export function useTranslate(): Localization['translate'] {
  // oxlint-disable-next-line typescript/unbound-method - game declares translate method-style
  const { translate } = useLocalization();

  return translate;
}
