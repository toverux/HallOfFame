// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable import/no-nodejs-modules -- a CLI script runs on Bun, not in the game.
// oxlint-disable no-await-in-loop -- one request at a time, in key order, is what this wants.

// Pushes locale-file edits to Crowdin flagged AI-translated, unapproved unless an edit replaces an
// approved translation.
//
// Nothing syncs the repo to Crowdin on its own: this uploads the source file first, so a key new to
// Crowdin exists for its translations to attach to and a reworded key carries its new text, then
// the changed translations. The repo's translations are machine output awaiting review: pushed
// unapproved, flagged as AI-translated and kept out of the translation memory, they stay visible to
// proofreaders as something to check, and a volunteer's later suggestion wins the export.
// When no translation is approved, the newest wins unless another has more votes.
//
// An approved translation outranks every unapproved one in the export, so an edit to a string that
// holds one, a volunteer's or a reworded key's old one the source upload kept, would be reverted by
// the next pull: this approves that edit instead, and the preview names it.
// Approving stamps a proofreading verdict volunteers cannot easily undo, so it goes no further than
// those strings. The script refuses to run on a project set to export approved translations only.
//
// Run it by hand, from the repo root, through `mise l10n:push`. It previews by default; `--push`
// performs the writes, and `--base <ref>` compares against something other than `HEAD`. Keep that
// ref close: a base reaching back across a pull commit makes the volunteers' translations look like
// local edits and pushes other people's work along with yours.
//
// `CROWDIN_PERSONAL_TOKEN` needs project write scope, from the project's owner, a manager, or a
// developer. Anything unexpected throws, which is the right behaviour for a script whose operator
// is watching it run: read the error and run it again.

import { parseArgs } from 'node:util';
import {
  api,
  fetchProject,
  languageIdsByFileName,
  list,
  LOCALES_DIRECTORY,
  projectId,
  readAtRef,
  readLocale,
  resolveCommit,
  SOURCE_FILE_NAME,
  sourceStrings,
  uploadSourceFile,
  git
} from './crowdin';

// Strict, so a mistyped flag throws instead of running another mode.
const { values: flags } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    base: { type: 'string', default: 'HEAD' },
    push: { type: 'boolean', default: false }
  }
});

const isPush = flags.push;

// The most operations one batch request carries.
const BATCH_SIZE = 100;

interface Change {
  readonly key: string;
  readonly stringId: number;
  // The string whose approvals settle this one: its master, where it duplicates another's text.
  readonly approvalStringId: number;
  readonly text: string;
}

interface Translation {
  readonly id: number;
  readonly stringId: number;
  readonly text: string;
  readonly user?: { readonly username: string };
}

// The approvals of one language, by the translation they stamp and by the string they settle.
interface Approvals {
  readonly byTranslation: ReadonlySet<number>;
  readonly byString: ReadonlyMap<number, number>;
}

await run();

async function run(): Promise<void> {
  const base = await resolveCommit(flags.base);

  console.info(`${isPush ? 'Pushing' : 'Previewing'} translations against ${base}.`);

  const fileNames = await changedLocaleFiles(base);
  const project = await fetchProject();

  // A pull would then bring the pushed strings back untranslated, reverting the repo too.
  if (project.exportApprovedOnly) {
    throw new Error(
      `Crowdin project ${projectId} exports approved translations only: unapproved ones would ` +
        `never reach the repo. Change the export settings.`
    );
  }

  const languageIds = languageIdsByFileName(project);
  const addedKeys = await syncSource();

  // After the source upload: an edit to the source file alone is a push too.
  if (fileNames.length == 0) {
    console.info(`No locale file changed against ${base}.`);

    return;
  }

  const strings = await sourceStrings();
  let pushed = 0;

  for (const fileName of fileNames) {
    const languageId = languageIds.get(fileName);

    if (languageId == null) {
      console.warn(`[${fileName}] no Crowdin language exports under this name, skipped.`);

      continue;
    }

    const before = await readAtRef(base, fileName);
    const after = await readLocale(fileName);
    const changes: Change[] = [];

    for (const [key, text] of Object.entries(after)) {
      // An emptied value is how Crowdin represents an untranslated string, not an edit to push.
      if (text == '' || text == before[key]) {
        continue;
      }

      const string = strings.get(key);

      if (string == null) {
        if (!isPush && addedKeys.has(key)) {
          console.info(`[${fileName}] ${key}: add unapproved, after the source upload`);
          pushed++;

          continue;
        }

        console.warn(`[${fileName}] ${key}: not on Crowdin, skipped.`);

        continue;
      }

      changes.push({ key, stringId: string.id, approvalStringId: string.masterId, text });
    }

    pushed += await pushLanguage(fileName, languageId, changes);
  }

  console.info(`Done: ${pushed} translation(s) ${isPush ? 'pushed' : 'to push'}.`);
}

// Uploads the source file where the repo's differs from Crowdin's, before any translation, and
// returns the keys new to Crowdin, which a preview can then count as pushable.
async function syncSource(): Promise<Set<string>> {
  const local = await readLocale(SOURCE_FILE_NAME);
  const remote = await sourceStrings();
  const added = Object.keys(local).filter(key => !remote.has(key));
  const reworded = Object.keys(local).filter(key => {
    const text = remote.get(key)?.text;

    return text != null && text != local[key];
  });
  const removed = [...remote.keys()].filter(key => !(key in local));

  if (added.length + reworded.length + removed.length == 0) {
    console.info(`Source file: in step with Crowdin.`);

    return new Set();
  }

  const summary = `${added.length} new, ${reworded.length} reworded, ${removed.length} removed`;

  if (!isPush) {
    console.info(`Source file: ${summary} key(s) to upload.`);

    return new Set(added);
  }

  const uploaded = await uploadSourceFile();

  console.info(
    `Source file: ${summary} key(s), ${uploaded ? 'uploaded' : 'unchanged for Crowdin'}.`
  );

  return new Set(added);
}

// Pushes one locale file's changes: the translations to add go in batches, then the approvals.
// Returns how many changes take a write.
async function pushLanguage(
  fileName: string,
  languageId: string,
  changes: readonly Change[]
): Promise<number> {
  if (changes.length == 0) {
    return 0;
  }

  const approvals = await languageApprovals(languageId);
  const exported = await exportedTranslations(
    languageId,
    changes.map(change => change.stringId)
  );
  const toAdd: Change[] = [];
  const toAddApproved: Change[] = [];
  const toApprove: number[] = [];

  for (const change of changes) {
    const label = `[${fileName}] ${change.key}`;
    const exportedTranslation = exported.get(change.stringId);
    const match = await matchingTranslation(languageId, change, exportedTranslation);

    // A push is rerun after a partial one, or after a pull: what it approved already stays as is.
    if (match && approvals.byTranslation.has(match.id)) {
      console.info(`${label}: already approved #${match.id}`);

      continue;
    }

    const approvedId = approvals.byString.get(change.approvalStringId);

    if (match && approvedId == null) {
      // An older variant the repo returns to is not the one Crowdin exports.
      const warning =
        exportedTranslation == null || exportedTranslation.id == match.id
          ? ''
          : ` (#${exportedTranslation.id} wins the export)`;

      console.info(`${label}: already on Crowdin as #${match.id}${warning}`);

      continue;
    }

    if (approvedId == null) {
      console.info(`${label}: add unapproved`);
      toAdd.push(change);

      continue;
    }

    // Whose text the approval stamps: a volunteer's, where a pull brought it in.
    const action = match
      ? `approve existing #${match.id} by ${match.user?.username ?? 'unknown'}`
      : 'add and approve';

    console.info(`${label}: ${action}, over approved #${approvedId}`);

    if (match) {
      toApprove.push(match.id);
    } else {
      toAddApproved.push(change);
    }
  }

  const pushed = toAdd.length + toAddApproved.length + toApprove.length;

  if (!isPush) {
    return pushed;
  }

  if (toAdd.length > 0) {
    await addTranslations(languageId, toAdd);
    console.info(`[${fileName}] added ${toAdd.length} unapproved translation(s)`);
  }

  if (toAddApproved.length + toApprove.length > 0) {
    const added = await addTranslations(languageId, toAddApproved);

    await approveTranslations([...toApprove, ...added]);
    console.info(`[${fileName}] approved ${toApprove.length + added.length} translation(s)`);
  }

  return pushed;
}

// The translation Crowdin already holds with this text, as it does for a volunteer's text a pull
// brought in: posting the same text again is rejected as a duplicate.
// The exported translation answers for most strings; another variant of a string that has one is
// looked up in full.
async function matchingTranslation(
  languageId: string,
  change: Change,
  exported: Translation | undefined
): Promise<Translation | undefined> {
  if (exported == null || exported.text == change.text) {
    return exported;
  }

  const query = `stringId=${change.stringId}&languageId=${languageId}`;
  const all = await list<Translation>(`/projects/${projectId}/translations?${query}`);

  return all.find(translation => translation.text == change.text);
}

// One translation per string: the one Crowdin would export, absent where the string has none.
async function exportedTranslations(
  languageId: string,
  stringIds: readonly number[]
): Promise<Map<number, Translation>> {
  const exported = new Map<number, Translation>();

  for (let i = 0; i < stringIds.length; i += BATCH_SIZE) {
    const ids = stringIds.slice(i, i + BATCH_SIZE).join(',');
    const translations = await list<Translation & { readonly translationId: number }>(
      `/projects/${projectId}/languages/${languageId}/translations?stringIds=${ids}`
    );

    for (const translation of translations) {
      exported.set(translation.stringId, { ...translation, id: translation.translationId });
    }
  }

  return exported;
}

// Every approval of the language at once: Crowdin files a duplicate source string's approvals under
// its master string, so a translation is looked up by its own id, and a string by its master's.
async function languageApprovals(languageId: string): Promise<Approvals> {
  const approvals = await list<{ readonly translationId: number; readonly stringId: number }>(
    `/projects/${projectId}/approvals?languageId=${languageId}`
  );

  return {
    byTranslation: new Set(approvals.map(approval => approval.translationId)),
    byString: new Map(approvals.map(approval => [approval.stringId, approval.translationId]))
  };
}

// Every add carries the AI flags and `addToTm: false`, approved or not, so unapproved machine text
// seeds no suggestion before a human vetted it. Approving still writes a translation to the memory,
// per Crowdin staff on its community forum.
// Returns the ids of the translations created, in the changes' order.
async function addTranslations(languageId: string, changes: readonly Change[]): Promise<number[]> {
  const ids: number[] = [];

  for (let i = 0; i < changes.length; i += BATCH_SIZE) {
    const operations = changes.slice(i, i + BATCH_SIZE).map(change => ({
      op: 'add',
      path: '/-',
      value: {
        stringId: change.stringId,
        languageId,
        text: change.text,
        addToTm: false,
        provider: 'ai',
        isPreTranslated: true
      }
    }));
    const added = (await api('PATCH', `/projects/${projectId}/translations`, operations)) as {
      data: Array<{ data: { id: number } }>;
    };

    ids.push(...added.data.map(item => item.data.id));
  }

  return ids;
}

// Crowdin moves the approval off the previously approved variant of the same string, so nothing has
// to be unapproved first.
async function approveTranslations(translationIds: readonly number[]): Promise<void> {
  for (let i = 0; i < translationIds.length; i += BATCH_SIZE) {
    const operations = translationIds.slice(i, i + BATCH_SIZE).map(translationId => ({
      op: 'add',
      path: '/-',
      value: { translationId }
    }));

    await api('PATCH', `/projects/${projectId}/approvals`, operations);
  }
}

// Locale files directly in the directory, the source file aside: editing that one changes the
// source strings, which `syncSource` uploads whole. Untracked files count, since `git diff` reports
// none and a locale file added but not yet staged is an edit like any other.
async function changedLocaleFiles(base: string): Promise<string[]> {
  const listUntracked = ['ls-files', '--others', '--exclude-standard', '--', LOCALES_DIRECTORY];
  // A file deleted since the base has nothing left to push.
  const tracked = await git([
    'diff',
    '--name-only',
    '--diff-filter=d',
    base,
    '--',
    LOCALES_DIRECTORY
  ]);
  const untracked = await git(listUntracked);
  const paths = new Set(`${tracked}\n${untracked}`.split('\n').filter(line => line != ''));
  const names = [...paths].map(path => path.slice(LOCALES_DIRECTORY.length + 1));

  return names.filter(name => name != SOURCE_FILE_NAME && !name.includes('/'));
}
