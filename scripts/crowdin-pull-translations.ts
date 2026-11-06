// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable import/no-nodejs-modules -- a CLI script runs on Bun, not in the game.
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
// project read scope, from the project's owner, a manager, or a developer.

import { parseArgs } from 'node:util';
import {
  fetchProject,
  languageIdsByFileName,
  list,
  LOCALES_DIRECTORY,
  projectId,
  readAtRef,
  readLocale,
  resolveCommit,
  SOURCE_FILE_NAME,
  stringIdsByKey
} from './crowdin';

// Strict, so a mistyped flag throws instead of running another mode.
const { values: flags } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    base: { type: 'string', default: 'HEAD' },
    write: { type: 'boolean', default: false },
    all: { type: 'boolean', default: false }
  }
});

const isWriting = flags.write;
const isAll = flags.all;

interface LanguageTranslation {
  readonly stringId: number;
  readonly text: string;
  readonly user?: { readonly username: string };
  readonly createdAt: string;
}

await run();

async function run(): Promise<void> {
  const base = await resolveCommit(flags.base);
  const source = await readLocale(SOURCE_FILE_NAME);
  const before = await readAtRef(base, SOURCE_FILE_NAME);
  const keys = Object.keys(source).filter(key => isAll || source[key] != before[key]);

  console.info(
    `${isWriting ? 'Pulling' : 'Previewing'} Crowdin translations of ${keys.length} source ` +
      `key(s)${isAll ? '' : ` added or changed since ${base}`}.`
  );

  if (keys.length == 0) {
    return;
  }

  const stringIds = await stringIdsByKey();
  const ids = keys.map(key => stringIds.get(key)).filter(id => id != null);

  if (ids.length < keys.length) {
    console.info(
      `${keys.length - ids.length} key(s) not on Crowdin yet: nothing to pull for them.`
    );
  }

  if (ids.length == 0) {
    return;
  }

  const keysById = new Map([...stringIds].map(([key, id]) => [id, key]));
  const project = await fetchProject();
  let pulled = 0;

  for (const [fileName, languageId] of languageIdsByFileName(project)) {
    const path = `${LOCALES_DIRECTORY}/${fileName}`;

    if (fileName == SOURCE_FILE_NAME) {
      continue;
    }

    if (!(await Bun.file(path).exists())) {
      console.warn(
        `[${fileName}] a Crowdin language exports under this name: no such file, skipped.`
      );

      continue;
    }

    const locale = await readLocale(fileName);
    const changed = new Map<string, string>();
    const translations = await languageTranslations(languageId, ids, project.exportApprovedOnly);

    for (const translation of translations) {
      const key = keysById.get(translation.stringId);

      if (key == null) {
        throw new Error(
          `Crowdin returned string ${translation.stringId}, which no source key holds.`
        );
      }

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

  console.info(isWriting ? `Done: ${pulled} translation(s) written.` : `Done.`);
}

// One translation per string: the one Crowdin would export, an approved one only where the project
// exports nothing else.
function languageTranslations(
  languageId: string,
  stringIds: readonly number[],
  isApprovedOnly: boolean
): Promise<LanguageTranslation[]> {
  const query = `stringIds=${stringIds.join(',')}${isApprovedOnly ? '&approvedOnly=1' : ''}`;

  return list<LanguageTranslation>(
    `/projects/${projectId}/languages/${languageId}/translations?${query}`
  );
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

    if (text != null) {
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
