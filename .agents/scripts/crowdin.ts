// The Crowdin project, its API and the git helpers the `l10n:*` scripts share. Not a CLI itself:
// `crowdin-push-translations.ts` and `crowdin-pull-translations.ts` import it.

export const projectId = 705_701;
const apiUrl = 'https://api.crowdin.com/api/v2';
// Crowdin's answer to a source upload whose content it already holds.
const notModified = 304;

// Where the locale files live, and which one is the source the others translate.
export const localesDirectory = 'HallOfFame/Locales';
export const sourceFileName = 'en-US.json';

export interface Project {
  readonly targetLanguages: ReadonlyArray<{ id: string; locale: string }>;
  readonly languageMapping: Record<string, { locale?: string }> | null;
  // Only sent to owners and managers: under a translator's token, the export guard cannot fire.
  readonly exportApprovedOnly?: boolean;
}

export async function fetchProject(): Promise<Project> {
  const project = (await api('GET', `/projects/${projectId}`)) as { data: Project };

  return project.data;
}

// Crowdin names an exported file after the target language's `locale`, unless the project remaps
// that name, which this reads back rather than assuming.
export function languageIdsByFileName(project: Project): Map<string, string> {
  const mapping = project.languageMapping ?? {};

  return new Map(
    project.targetLanguages.map(language => [
      `${mapping[language.id]?.locale ?? language.locale}.json`,
      language.id
    ])
  );
}

// The source file on Crowdin, found by name: there is one per project.
export async function sourceFile(): Promise<{ id: number }> {
  const files = (await api('GET', `/projects/${projectId}/files?limit=500`)) as {
    data: Array<{ data: { id: number; name: string } }>;
  };

  const source = files.data.find(file => file.data.name == sourceFileName)?.data;

  if (source == undefined) {
    throw new Error(`No ${sourceFileName} in Crowdin project ${projectId}.`);
  }

  return source;
}

// Every source string by key, with its Crowdin id and text. The JSON parser stores each key as its
// quoted source text, so `"HallOfFame.Common.OOPS"` is the identifier of the key
// `HallOfFame.Common.OOPS`.
export async function sourceStrings(): Promise<Map<string, { id: number; text: string }>> {
  const source = await sourceFile();

  const strings = (await api(
    'GET',
    `/projects/${projectId}/strings?fileId=${source.id}&limit=500`
  )) as {
    data: Array<{ data: { id: number; identifier: string; text: string } }>;
  };

  return new Map(
    strings.data.map(item => [
      JSON.parse(item.data.identifier),
      { id: item.data.id, text: item.data.text }
    ])
  );
}

export async function stringIdsByKey(): Promise<Map<string, number>> {
  return new Map([...(await sourceStrings())].map(([key, string]) => [key, string.id]));
}

// Replaces the source file on Crowdin with the repo's, keeping every translation and approval, so a
// reworded key keeps what volunteers wrote until it is retranslated. Returns false where Crowdin
// found the file unchanged.
export async function uploadSourceFile(): Promise<boolean> {
  const content = await Bun.file(`${localesDirectory}/${sourceFileName}`).text();

  const stored = await request('POST', '/storages', content, {
    'content-type': 'application/octet-stream',
    'crowdin-api-filename': sourceFileName
  });

  if (!stored.ok) {
    throw new Error(`Crowdin POST /storages: ${stored.status} ${await stored.text()}`);
  }

  const storage = (await stored.json()) as { data: { id: number } };
  const source = await sourceFile();
  const path = `/projects/${projectId}/files/${source.id}`;

  const updated = await request(
    'PUT',
    path,
    JSON.stringify({ storageId: storage.data.id, updateOption: 'keep_translations_and_approvals' }),
    { 'content-type': 'application/json' }
  );

  if (updated.status == notModified) {
    return false;
  }

  if (!updated.ok) {
    throw new Error(`Crowdin PUT ${path}: ${updated.status} ${await updated.text()}`);
  }

  return true;
}

export async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await request(
    method,
    path,
    body == undefined ? undefined : JSON.stringify(body),
    { 'content-type': 'application/json' }
  );

  if (!response.ok) {
    throw new Error(`Crowdin ${method} ${path}: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function request(
  method: string,
  path: string,
  body: string | undefined,
  headers: Record<string, string>
): Promise<Response> {
  const token = Bun.env.CROWDIN_PERSONAL_TOKEN;

  if (!token) {
    throw new Error(
      `CROWDIN_PERSONAL_TOKEN is not set. Create one with project write scope at ` +
        `https://crowdin.com/settings#api-key and export it before running.`
    );
  }

  return fetch(`${apiUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...headers },
    ...(body == undefined ? {} : { body })
  });
}

// A locale file as the working tree holds it; `readAtRef` reads the same file at a commit.
export async function readLocale(fileName: string): Promise<Record<string, string>> {
  return (await Bun.file(`${localesDirectory}/${fileName}`).json()) as Record<string, string>;
}

// A file absent from the ref is a locale added since, whose every key then reads as changed. That
// is proved with `cat-file -e` rather than inferred from a failed read: every other way of failing
// would otherwise read as "no previous version", which turns one unreadable file into an approval
// of the whole locale.
export async function readAtRef(base: string, fileName: string): Promise<Record<string, string>> {
  const revision = `${base}:${localesDirectory}/${fileName}`;
  const child = Bun.spawn(['git', 'cat-file', '-e', revision], { stderr: 'ignore' });

  if ((await child.exited) != 0) {
    return {};
  }

  return JSON.parse(await git(['show', revision])) as Record<string, string>;
}

// A range is valid to `git diff` but not to `git show <ref>:<path>`, which would make every
// baseline read as an absent file, every key read as new, and the whole locale get approved.
export async function resolveCommit(ref: string): Promise<string> {
  const resolved = await git(['rev-parse', '--verify', `${ref}^{commit}`]).catch(() => null);

  if (resolved == null) {
    throw new Error(`--base ${ref} does not name one commit. A range cannot be a baseline.`);
  }

  return resolved.trim();
}

export function baseRef(): string {
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

export async function git(args: string[]): Promise<string> {
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
