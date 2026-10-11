// Version: 1.0.0

// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable no-await-in-loop -- one request per language, in file order, is what this wants.

// Pulls Crowdin's current translations of the source keys added or changed since `--base` into the
// locale files, before the repo gets translations of its own: a volunteer may have translated them
// already, and nothing brings their work into the repo but this script, so a translation written in
// the repo meanwhile would be pushed over theirs. `--all` pulls every source key instead, which is
// how a release takes in the volunteers' work since the last one.
//
// It previews by default, listing each key whose Crowdin text differs from the working tree with
// the translation's author and date; `--write` puts Crowdin's text into the locale files, in source
// key order. A key not on Crowdin yet has nothing to pull until a push uploads it.
//
// Run it by hand, from the repo root, through `mise l10n:pull`. `CROWDIN_PERSONAL_TOKEN` needs
// project read scope.

import {
  api,
  baseRef,
  fetchProject,
  languageIdsByFileName,
  localesDirectory,
  projectId,
  readAtRef,
  readLocale,
  resolveCommit,
  sourceFileName,
  stringIdsByKey
} from './crowdin';

const isWriting = Bun.argv.includes('--write');
const isAll = Bun.argv.includes('--all');

interface LanguageTranslation {
  readonly stringId: number;
  readonly text: string;
  readonly user?: { readonly username: string };
  readonly createdAt: string;
}

await run();

async function run(): Promise<void> {
  const base = await resolveCommit(baseRef());
  const source = await readLocale(sourceFileName);
  const before = await readAtRef(base, sourceFileName);
  const keys = Object.keys(source).filter(key => isAll || source[key] != before[key]);

  console.info(
    `${isWriting ? 'Pulling' : 'Previewing'} Crowdin translations of ${keys.length} source ` +
      `key(s)${isAll ? '' : ` added or changed since ${base}`}.`
  );

  if (keys.length == 0) {
    return;
  }

  const stringIds = await stringIdsByKey();
  const ids = keys.map(key => stringIds.get(key)).filter(id => id != undefined);

  if (ids.length < keys.length) {
    console.info(
      `${keys.length - ids.length} key(s) not on Crowdin yet: nothing to pull for them.`
    );
  }

  if (ids.length == 0) {
    return;
  }

  const keysById = new Map([...stringIds].map(([key, id]) => [id, key]));
  let pulled = 0;

  for (const [fileName, languageId] of languageIdsByFileName(await fetchProject())) {
    const path = `${localesDirectory}/${fileName}`;

    if (fileName == sourceFileName || !(await Bun.file(path).exists())) {
      continue;
    }

    const locale = await readLocale(fileName);
    const changed = new Map<string, string>();

    for (const translation of await languageTranslations(languageId, ids)) {
      const key = keysById.get(translation.stringId) ?? '';

      // An emptied text is how Crowdin represents an untranslated string.
      if (translation.text == '' || translation.text == locale[key]) {
        continue;
      }

      const [date] = translation.createdAt.split('T');
      const who = `${translation.user?.username ?? 'unknown'}, ${date}`;
      const repo = key in locale ? `repo ${JSON.stringify(locale[key])}` : 'not in the repo';

      console.info(
        `[${fileName}] ${key}: Crowdin ${JSON.stringify(translation.text)} (${who}), ${repo}`
      );
      changed.set(key, translation.text);
    }

    if (isWriting && changed.size > 0) {
      await Bun.write(path, serialize(source, locale, changed));
      pulled += changed.size;
    }
  }

  console.info(isWriting ? `Done: ${pulled} translation(s) written.` : 'Done.');
}

// One translation per string: the one Crowdin would export.
async function languageTranslations(
  languageId: string,
  stringIds: readonly number[]
): Promise<LanguageTranslation[]> {
  const query = `stringIds=${stringIds.join(',')}&limit=500`;
  const path = `/projects/${projectId}/languages/${languageId}/translations?${query}`;
  const result = (await api('GET', path)) as { data: Array<{ data: LanguageTranslation }> };

  return result.data.map(item => item.data);
}

// Source key order, so a key new to the locale lands where the source has it; a key the source
// dropped keeps its place at the end: a pull adds and replaces, never removes.
function serialize(
  source: Record<string, string>,
  locale: Record<string, string>,
  changed: ReadonlyMap<string, string>
): string {
  const merged: Record<string, string> = {};

  for (const key of Object.keys(source)) {
    const text = changed.get(key) ?? locale[key];

    if (text != undefined) {
      merged[key] = text;
    }
  }

  for (const [key, text] of Object.entries(locale)) {
    if (!(key in source)) {
      merged[key] = text;
    }
  }

  return `${JSON.stringify(merged, null, 2)}\n`;
}
