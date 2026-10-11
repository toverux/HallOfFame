// Version: 3.0.0

// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable no-await-in-loop -- one request at a time, in key order, is what this wants.

// Pushes locale-file edits to Crowdin and approves exactly the strings that changed.
//
// Nothing syncs the repo to Crowdin on its own: this uploads the source file first, so a key new
// to Crowdin exists for its translations to attach to and a reworded key carries its new text,
// then the changed translations. An approved translation is what a pull brings back over an
// unapproved one, so this approves the keys it pushed, and only those.
//
// `--no-approve` adds the changed keys as unapproved translations instead, for machine translations
// a proofreader should still review: approving those would stamp a verdict on them that deters
// volunteers. They are flagged as AI-translated and kept out of the translation memory. Crowdin
// exports an unapproved translation only while no other one of that string is approved, so an edit
// to an approved string is still reverted by the next pull; the preview flags those keys. When no
// translation is approved, the newest wins unless another has more votes. This mode refuses to run
// on a project set to export approved translations only.
//
// Run it by hand, from the repo root, through `mise l10n:push`. It previews by default; `--push`
// performs the writes, and `--base <ref>` compares against something other than `HEAD`. Keep that
// ref close: a base reaching back across a pull commit makes the volunteers' translations look
// like local edits and pushes other people's work along with yours.
//
// `CROWDIN_PERSONAL_TOKEN` needs project write scope. Anything unexpected throws, which is the
// right behaviour for a script whose operator is watching it run: read the error and run it again.

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
  sourceStrings,
  stringIdsByKey,
  uploadSourceFile,
  git
} from './crowdin';

const isPush = Bun.argv.includes('--push');
const isApproving = !Bun.argv.includes('--no-approve');

interface Change {
  readonly fileName: string;
  readonly languageId: string;
  readonly key: string;
  readonly text: string;
}

interface Translation {
  readonly id: number;
  readonly text: string;
}

await run();

async function run(): Promise<void> {
  const base = await resolveCommit(baseRef());
  const mode = isApproving ? 'approved' : 'unapproved';

  console.info(`${isPush ? 'Pushing' : 'Previewing'} ${mode} translations against ${base}.`);

  const fileNames = await changedLocaleFiles(base);
  const project = await fetchProject();

  // A pull would then bring the pushed strings back untranslated, reverting the repo too.
  if (!isApproving && project.exportApprovedOnly) {
    throw new Error(
      `Crowdin project ${projectId} exports approved translations only: unapproved ones would ` +
        `never reach the repo. Push without --no-approve, or change the export settings.`
    );
  }

  const languageIds = languageIdsByFileName(project);
  const addedKeys = await syncSource();

  // After the source upload: an edit to the source file alone is a push too.
  if (fileNames.length == 0) {
    console.info(`No locale file changed against ${base}.`);

    return;
  }

  const stringIds = await stringIdsByKey();
  let pushed = 0;

  for (const fileName of fileNames) {
    const languageId = languageIds.get(fileName);

    if (languageId == undefined) {
      console.warn(`[${fileName}] no Crowdin language exports under this name, skipped.`);

      continue;
    }

    const before = await readAtRef(base, fileName);
    const after = await readLocale(fileName);

    for (const [key, text] of Object.entries(after)) {
      // An emptied value is how Crowdin represents an untranslated string, not an edit to push.
      if (text == '' || text == before[key]) {
        continue;
      }

      const stringId = stringIds.get(key);

      if (stringId == undefined) {
        if (!isPush && addedKeys.has(key)) {
          const action = isApproving ? 'add and approve' : 'add unapproved';

          console.info(`[${fileName}] ${key}: ${action}, after the source upload`);
          pushed++;

          continue;
        }

        console.warn(`[${fileName}] ${key}: not on Crowdin, skipped.`);

        continue;
      }

      if (await push({ fileName, languageId, key, text }, stringId)) {
        pushed++;
      }
    }
  }

  const outcome = isPush ? `${mode} translation(s) pushed` : `${mode} translation(s) to push`;

  console.info(`Done: ${pushed} ${outcome}.`);
}

// Uploads the source file where the repo's differs from Crowdin's, before any translation, and
// returns the keys new to Crowdin, which a preview can then count as pushable.
async function syncSource(): Promise<Set<string>> {
  const local = await readLocale(sourceFileName);
  const remote = await sourceStrings();
  const added = Object.keys(local).filter(key => !remote.has(key));
  const reworded = Object.keys(local).filter(key => {
    const text = remote.get(key)?.text;

    return text != undefined && text != local[key];
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

// Reuses the matching translation when Crowdin already holds one, as it does for a volunteer's
// text a pull brought in: posting the same text again is rejected as a duplicate. Returns whether
// the change takes a write.
async function push(change: Change, stringId: number): Promise<boolean> {
  const query = `stringId=${stringId}&languageId=${change.languageId}&limit=500`;
  const existing = (await api('GET', `/projects/${projectId}/translations?${query}`)) as {
    data: Array<{ data: Translation }>;
  };

  const match = existing.data.find(item => item.data.text == change.text)?.data;
  const label = `[${change.fileName}] ${change.key}`;

  if (!isApproving) {
    return suggest({ change, stringId, label, match });
  }

  // A push is rerun after a partial one, or after a pull: what it approved already stays as is.
  if (match && (await approvedTranslationId(change.languageId, stringId, match)) == match.id) {
    console.info(`${label}: already approved #${match.id}`);

    return false;
  }

  if (!isPush) {
    console.info(`${label}: ${match ? `approve existing #${match.id}` : 'add and approve'}`);

    return true;
  }

  const translationId = match?.id ?? (await addTranslation(change, stringId));

  // Crowdin moves the approval off the previously approved variant of the same string, so nothing
  // has to be unapproved first.
  await api('POST', `/projects/${projectId}/approvals`, { translationId });

  console.info(`${label}: approved #${translationId}${match ? '' : ' (new)'}`);

  return true;
}

// An approved translation outranks every unapproved one in the export, so a repo edit pushed next
// to it is reverted by the next pull: the operator is told, and decides whether to approve.
async function suggest(target: {
  readonly change: Change;
  readonly stringId: number;
  readonly label: string;
  readonly match: Translation | undefined;
}): Promise<boolean> {
  const { change, stringId, label, match } = target;
  const approvedId = await approvedTranslationId(change.languageId, stringId);

  const warning =
    approvedId == undefined || approvedId == match?.id
      ? ''
      : ` (approved #${approvedId} still wins the export)`;

  if (match) {
    console.info(`${label}: already on Crowdin as #${match.id}${warning}`);

    return false;
  }

  if (!isPush) {
    console.info(`${label}: add unapproved${warning}`);

    return true;
  }

  const translationId = await addTranslation(change, stringId);

  console.info(`${label}: added unapproved #${translationId}${warning}`);

  return true;
}

// Asked by translation where the question is whether that one is approved: Crowdin files a
// duplicate source string's approvals under its master string, so a lookup by the duplicate's own
// id misses them. Asked by string where the question is whether any translation of it is.
async function approvedTranslationId(
  languageId: string,
  stringId: number,
  match?: Translation
): Promise<number | undefined> {
  const query = match
    ? `translationId=${match.id}`
    : `stringId=${stringId}&languageId=${languageId}`;
  const approvals = (await api('GET', `/projects/${projectId}/approvals?${query}`)) as {
    data: Array<{ data: { translationId: number } }>;
  };

  return approvals.data[0]?.data.translationId;
}

// Unapproved text is machine output awaiting review: flagged as such for proofreaders, and kept out
// of the translation memory so it does not seed suggestions before a human vetted it.
async function addTranslation(change: Change, stringId: number): Promise<number> {
  const added = (await api('POST', `/projects/${projectId}/translations`, {
    stringId,
    languageId: change.languageId,
    text: change.text,
    ...(isApproving ? {} : { addToTm: false, provider: 'ai', isPreTranslated: true })
  })) as { data: { id: number } };

  return added.data.id;
}

// Locale files directly in the directory, the source file aside: editing that one changes the
// source strings, which `syncSource` uploads whole. Untracked files count, since `git diff` reports
// none and a locale file added but not yet staged is an edit like any other.
async function changedLocaleFiles(base: string): Promise<string[]> {
  const listUntracked = ['ls-files', '--others', '--exclude-standard', '--', localesDirectory];
  const tracked = await git(['diff', '--name-only', base, '--', localesDirectory]);
  const untracked = await git(listUntracked);
  const paths = new Set(`${tracked}\n${untracked}`.split('\n').filter(line => line != ''));
  const names = [...paths].map(path => path.slice(localesDirectory.length + 1));

  return names.filter(name => name != sourceFileName && !name.includes('/'));
}
