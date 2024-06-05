import { bindValue, useValue } from 'cs2/api';
import { type Locale, enUS } from 'date-fns/locale';
import { useEffect, useState } from 'react';

const locale$ = bindValue<SupportedLocale>('hallOfFame', 'locale', 'en-US');

/**
 * Locales supported by the game, derived from
 * `GameManager.instance.localizationManager.GetSupportedLocales()`.
 */
type SupportedLocale =
    | 'de-DE'
    | 'en-US'
    | 'es-ES'
    | 'fr-FR'
    | 'it-IT'
    | 'ja-JP'
    | 'ko-KR'
    | 'pl-PL'
    | 'pt-BR'
    | 'ru-RU'
    | 'zh-HANS'
    | 'zh-HANT';

/**
 * Mapping of supported locales to their respective date-fns locale modules.
 * We use dynamic imports to load the locale modules asynchronously and avoid
 * bloating the main bundle size.
 */
const dfnsLocaleByLocale: Record<SupportedLocale, () => Promise<Locale>> = {
    'de-DE': () => import('date-fns/locale/de').then(m => m.de),
    'en-US': () => Promise.resolve(enUS),
    'es-ES': () => import('date-fns/locale/es').then(m => m.es),
    'fr-FR': () => import('date-fns/locale/fr').then(m => m.fr),
    'it-IT': () => import('date-fns/locale/it').then(m => m.it),
    'ja-JP': () => import('date-fns/locale/ja').then(m => m.ja),
    'ko-KR': () => import('date-fns/locale/ko').then(m => m.ko),
    'pl-PL': () => import('date-fns/locale/pl').then(m => m.pl),
    'pt-BR': () => import('date-fns/locale/pt-BR').then(m => m.ptBR),
    'ru-RU': () => import('date-fns/locale/ru').then(m => m.ru),
    'zh-HANS': () => import('date-fns/locale/zh-CN').then(m => m.zhCN),
    'zh-HANT': () => import('date-fns/locale/zh-TW').then(m => m.zhTW)
};

/**
 * Custom hook to load and get the date-fns locale module matching the current
 * active locale.
 */
export function useDateFnsLocale(): Locale {
    const locale = useValue(locale$);
    const [dfnsLocale, setDfnsLocale] = useState<Locale>(enUS);

    useEffect(() => {
        // Flag to track if the component is mounted
        let isMounted = true;

        const loadLocale = async () => {
            // Load the locale module asynchronously.
            const loader =
                dfnsLocaleByLocale[locale] ?? dfnsLocaleByLocale['en-US'];

            const localeModule = await loader();

            // Update the state only if the component is still mounted.
            if (isMounted) {
                setDfnsLocale(localeModule);
            }
        };

        void loadLocale();

        // Cleanup function to set the mounted flag to false.
        return () => {
            isMounted = false;
        };
    }, [locale]);

    return dfnsLocale;
}
