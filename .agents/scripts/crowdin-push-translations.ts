// Version: 2.1.0

// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable no-await-in-loop -- one request at a time, in key order, is what this wants.

// Pushes locale-file edits to Crowdin and approves exactly the strings that changed.
//
// The Crowdin GitHub integration already uploads `HallOfFame/Locales/*.json` on sync, but it
// uploads them unapproved: when a string already carries an approved translation, that older one
// keeps winning the export and the repo edit is silently dropped on the next round trip. Approving
// is what makes an edit stick, so this approves the keys it pushed, and only those.
//
// `--no-approve` adds the changed keys as unapproved translations instead, for machine translations
// a proofreader should still review: approving those would stamp a verdict on them that deters
// volunteers. They are flagged as AI-translated and kept out of the translation memory. Crowdin
// exports an unapproved translation only while no other one of that string is approved, so an edit
// to an approved string is still reverted by the next sync; the preview flags those keys. When no
// translation is approved, the newest wins unless another has more votes. This mode refuses to run
// on a project set to export approved translations only.
//
// Run it by hand, from the repo root, through `mise l10n:push`. It previews by default; `--push`
// performs the writes, and `--base <ref>` compares against something other than `HEAD`. Keep that
// ref close: a base reaching back across a merged Crowdin sync makes that sync's translations look
// like local edits and pushes other people's work along with yours.
//
// `CROWDIN_PERSONAL_TOKEN` needs project write scope. Anything unexpected throws, which is the
// right behaviour for a script whose operator is watching it run: read the error and run it again.

const projectId = 705_701;
const apiUrl = 'https://api.crowdin.com/api/v2';

// Duplicated from `crowdin.yml` on purpose: reading them from there means modelling that file's
// schema, which is more machinery than the drift is worth.
const localesDirectory = 'HallOfFame/Locales';
const sourceFileName = 'en-US.json';

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

interface Project {
  readonly targetLanguages: ReadonlyArray<{ id: string; locale: string }>;
  readonly languageMapping: Record<string, { locale?: string }> | null;
  // Only sent to owners and managers: under a translator's token, the export guard cannot fire.
  readonly exportApprovedOnly?: boolean;
}

await run();

async function run(): Promise<void> {
  const base = await resolveCommit(baseRef());
  const mode = isApproving ? 'approved' : 'unapproved';

  console.info(`${isPush ? 'Pushing' : 'Previewing'} ${mode} translations against ${base}.`);

  const fileNames = await changedLocaleFiles(base);

  if (fileNames.length == 0) {
    console.info(`No locale file changed against ${base}.`);

    return;
  }

  const project = await fetchProject();

  // The next sync would then export the pushed strings as untranslated, reverting the repo too.
  if (!isApproving && project.exportApprovedOnly) {
    throw new Error(
      `Crowdin project ${projectId} exports approved translations only: unapproved ones would ` +
        `never reach the repo. Push without --no-approve, or change the export settings.`
    );
  }

  const languageIds = languageIdsByFileName(project);
  const stringIds = await stringIdsByKey();
  let pushed = 0;

  for (const fileName of fileNames) {
    const languageId = languageIds.get(fileName);

    if (languageId == undefined) {
      console.warn(`[${fileName}] no Crowdin language exports under this name, skipped.`);

      continue;
    }

    const before = await readAtRef(base, fileName);
    const after = (await Bun.file(`${localesDirectory}/${fileName}`).json()) as Record<
      string,
      string
    >;

    for (const [key, text] of Object.entries(after)) {
      // An emptied value is how Crowdin represents an untranslated string, not an edit to push.
      if (text == '' || text == before[key]) {
        continue;
      }

      const stringId = stringIds.get(key);

      if (stringId == undefined) {
        console.warn(`[${fileName}] ${key}: not on Crowdin yet, skipped. Sync, then push again.`);

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

// Reuses the matching translation when Crowdin already holds one, which it usually does: the
// GitHub sync uploads repo edits as unapproved variants, and posting the same text again is
// rejected as a duplicate. Returns whether the change takes a write.
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
// to it is reverted by the next sync: the operator is told, and decides whether to approve.
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

async function approvedTranslationId(
  languageId: string,
  stringId: number
): Promise<number | undefined> {
  const query = `stringId=${stringId}&languageId=${languageId}`;
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

async function fetchProject(): Promise<Project> {
  const project = (await api('GET', `/projects/${projectId}`)) as { data: Project };

  return project.data;
}

// Crowdin names an exported file after the target language's `locale`, unless the project remaps
// that name, which this reads back rather than assuming.
function languageIdsByFileName(project: Project): Map<string, string> {
  const mapping = project.languageMapping ?? {};

  return new Map(
    project.targetLanguages.map(language => [
      `${mapping[language.id]?.locale ?? language.locale}.json`,
      language.id
    ])
  );
}

// The JSON parser stores each key as its quoted source text, so `"HallOfFame.Common.OOPS"` is the
// identifier of the key `HallOfFame.Common.OOPS`.
async function stringIdsByKey(): Promise<Map<string, number>> {
  const files = (await api('GET', `/projects/${projectId}/files?limit=500`)) as {
    data: Array<{ data: { id: number; name: string } }>;
  };

  const source = files.data.find(file => file.data.name == sourceFileName)?.data;

  if (source == undefined) {
    throw new Error(`No ${sourceFileName} in Crowdin project ${projectId}.`);
  }

  const strings = (await api(
    'GET',
    `/projects/${projectId}/strings?fileId=${source.id}&limit=500`
  )) as {
    data: Array<{ data: { id: number; identifier: string } }>;
  };

  return new Map(strings.data.map(item => [JSON.parse(item.data.identifier), item.data.id]));
}

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const token = Bun.env.CROWDIN_PERSONAL_TOKEN;

  if (!token) {
    throw new Error(
      `CROWDIN_PERSONAL_TOKEN is not set. Create one with project write scope at ` +
        `https://crowdin.com/settings#api-key and export it before running.`
    );
  }

  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: { 'authorization': `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body == undefined ? {} : { body: JSON.stringify(body) })
  });

  if (!response.ok) {
    throw new Error(`Crowdin ${method} ${path}: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

// Locale files directly in the directory, the source file aside: editing that one changes the
// source strings, which is the GitHub sync's job. Untracked files count, since `git diff` reports
// none and a locale file added but not yet staged is an edit like any other.
async function changedLocaleFiles(base: string): Promise<string[]> {
  const listUntracked = ['ls-files', '--others', '--exclude-standard', '--', localesDirectory];
  const tracked = await git(['diff', '--name-only', base, '--', localesDirectory]);
  const untracked = await git(listUntracked);
  const paths = new Set(`${tracked}\n${untracked}`.split('\n').filter(line => line != ''));
  const names = [...paths].map(path => path.slice(localesDirectory.length + 1));

  return names.filter(name => name != sourceFileName && !name.includes('/'));
}

// A file absent from the ref is a locale added since, whose every key then reads as changed. That
// is proved with `cat-file -e` rather than inferred from a failed read: every other way of failing
// would otherwise read as "no previous version", which turns one unreadable file into an approval
// of the whole locale.
async function readAtRef(base: string, fileName: string): Promise<Record<string, string>> {
  const revision = `${base}:${localesDirectory}/${fileName}`;
  const child = Bun.spawn(['git', 'cat-file', '-e', revision], { stderr: 'ignore' });

  if ((await child.exited) != 0) {
    return {};
  }

  return JSON.parse(await git(['show', revision])) as Record<string, string>;
}

// A range is valid to `git diff` but not to `git show <ref>:<path>`, which would make every
// baseline read as an absent file, every key read as new, and the whole locale get approved.
async function resolveCommit(ref: string): Promise<string> {
  const resolved = await git(['rev-parse', '--verify', `${ref}^{commit}`]).catch(() => null);

  if (resolved == null) {
    throw new Error(`--base ${ref} does not name one commit. A range cannot be a baseline.`);
  }

  return resolved.trim();
}

function baseRef(): string {
  const index = Bun.argv.indexOf('--base');

  if (index == -1) {
    return 'HEAD';
  }

  const value = Bun.argv[index + 1];

  if (value == undefined || value.startsWith('--')) {
    throw new Error(`--base needs a value.`);
  }

  return value;
}

async function git(args: string[]): Promise<string> {
  const child = Bun.spawn(['git', ...args], { stdout: 'pipe', stderr: 'pipe' });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited
  ]);

  if (exitCode != 0) {
    throw new Error(`git ${args.join(' ')} failed: ${stderr.trim()}`);
  }

  return stdout;
}
