// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable no-await-in-loop -- one write at a time keeps the log in order.

// Copies Skyve's stability labels from Skyve's repository into `HallOfFame/Locales/Skyve`, one
// trimmed file per locale the mod ships, which the mod's locale loader registers under the
// `HallOfFame.Skyve.` prefix.
//
// The labels are Skyve's own words, translated by Skyve's volunteers: they stay out of Crowdin, and
// out of `mise l10n:push`, which only reads the locale files directly in `HallOfFame/Locales`. A
// label Skyve lacks in a locale is filled from Skyve's English.
//
// Run it through `mise l10n:skyve`. It reads the pinned commit below, so it writes the same files
// every time: move the pin to pick up Skyve's newer translations.

const skyveCommit = '09cc376489dd5c1e90b560973a5fdb4057c8d687';
const skyveFilesUrl = `https://raw.githubusercontent.com/JadHajjar/Skyve/${skyveCommit}/Skyve.Systems/Properties`;

const localesDirectory = 'HallOfFame/Locales';
const outputDirectory = `${localesDirectory}/Skyve`;

// The stability labels, and the name of the group the UI files three of them under, the other
// group names being stability labels too.
const labelKeys: readonly string[] = [
  'Stable',
  'StableNoNewFeatures',
  'StableNoFutureUpdates',
  'NotEnoughInformation',
  'Caution',
  'BreaksOnPatch',
  'NumerousReports',
  'CautionWhenUsing',
  'HasIssues',
  'HasIssuesNoFutureUpdates',
  'Obsolete',
  'Broken',
  'BrokenFromPatch',
  'BrokenFromNewVersion'
];

// The mod's locales Skyve names otherwise. English comes from Skyve's source file, not from a
// translation.
const skyveLocales: ReadonlyMap<string, string> = new Map([
  ['zh-HANS', 'zh-CN'],
  ['zh-HANT', 'zh-TW']
]);

const englishLocale = 'en-US';

const english = await fetchSkyveLabels('Compatibility.json');

const missingInEnglish = labelKeys.filter(key => !english.has(key));

if (missingInEnglish.length > 0) {
  throw new Error(`Skyve's English labels lack ${missingInEnglish.join(', ')}.`);
}

const locales = await shippedLocales();

// Every locale or none: a failed fetch fails the import before any file is written.
const translations = await Promise.all(
  locales.map(
    async locale =>
      [
        locale,
        locale == englishLocale
          ? english
          : await fetchSkyveLabels(`Compatibility/${skyveLocales.get(locale) ?? locale}.json`)
      ] as const
  )
);

for (const [locale, translated] of translations) {
  const filled = labelKeys.filter(key => !translated.has(key));

  const labels = Object.fromEntries(
    labelKeys.map(key => [key, translated.get(key) ?? english.get(key)])
  );

  await Bun.write(`${outputDirectory}/${locale}.json`, `${JSON.stringify(labels, null, 2)}\n`);

  console.log(
    filled.length > 0
      ? `[${locale}] written, ${filled.join(', ')} filled from English.`
      : `[${locale}] written.`
  );
}

// The locale files directly in the locale directory, by locale name.
async function shippedLocales(): Promise<string[]> {
  const fileNames = await Array.fromAsync(new Bun.Glob('*.json').scan(localesDirectory));

  return fileNames.map(fileName => fileName.slice(0, -'.json'.length)).toSorted();
}

async function fetchSkyveLabels(path: string): Promise<ReadonlyMap<string, string>> {
  const url = `${skyveFilesUrl}/${path}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}.`);
  }

  const labels: unknown = await response.json();

  if (typeof labels != 'object' || labels == null) {
    throw new TypeError(`${url} holds no JSON object.`);
  }

  // An empty label is one Skyve's translators have not written yet.
  return new Map(
    Object.entries(labels).filter(
      (entry): entry is [string, string] => typeof entry[1] == 'string' && entry[1] != ''
    )
  );
}
