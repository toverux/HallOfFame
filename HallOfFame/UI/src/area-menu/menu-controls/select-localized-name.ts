import type { ModSettings } from '../../utils/bindings';

/**
 * The raw, multi-form name of an entity (a city or a creator) as it comes from the server: the
 * native {@link value}, plus its optional romanized and translated variants and source locale.
 */
export interface LocalizableName {
  readonly value: string;
  readonly latinized: string | null;
  readonly translated: string | null;
  readonly locale: string | null;
}

/**
 * The name resolved for display, given the user's translation mode and the game's locale.
 */
export interface LocalizedName {
  /**
   * The name to display, or `null` when the chosen variant is missing (the caller decides on a
   * fallback, e.g. "anonymous" for creators).
   */
  readonly name: string | null;

  /**
   * Whether {@link name} is a translated/romanized form rather than the native {@link value}.
   * Drives whether the original-name tooltip is shown.
   */
  readonly isTranslated: boolean;

  /**
   * The "other" romanization shown in the tooltip beside the native name: the romanized form when
   * translating, the translated form otherwise.
   */
  readonly alternate: string | null;
}

/**
 * Resolves which form of an entity name to display, plus the data the tooltip needs, from the user's
 * translation mode and the game's current locale.
 *
 * A name is considered translated only when a mode is active, the name has a source locale, and that
 * locale differs from the game's, in which case the transliterated or translated variant is chosen
 * per the mode. Otherwise the native value is used.
 */
export function selectLocalizedName(
  mode: ModSettings['namesTranslationMode'],
  gameLocale: string,
  name: Readonly<LocalizableName>
): Readonly<LocalizedName> {
  const isTranslated =
    mode != 'disabled' && name.locale != null && !gameLocale.startsWith(name.locale);

  const displayName = isTranslated
    ? mode == 'transliterate'
      ? name.latinized
      : name.translated
    : name.value;

  const alternate = mode == 'translate' ? name.latinized : name.translated;

  return { name: displayName, isTranslated, alternate };
}
