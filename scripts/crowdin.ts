// The Crowdin project, its API, and the git helpers the `l10n:*` scripts share. Not a CLI itself:
// `crowdin-push-translations.ts` and `crowdin-pull-translations.ts` import it.

export const projectId = readProjectId();
const API_URL = 'https://api.crowdin.com/api/v2';
// The most items a Crowdin list endpoint returns per request.
const PAGE_SIZE = 500;

// Where the locale files live, and which one is the source the others translate.
export const LOCALES_DIRECTORY = 'HallOfFame/Locales';
export const SOURCE_FILE_NAME = 'en-US.json';

export interface Project {
  readonly targetLanguages: ReadonlyArray<{ readonly id: string; readonly locale: string }>;
  readonly languageMapping: Readonly<Record<string, { readonly locale?: string }>> | null;
  readonly exportApprovedOnly: boolean;
}

// Crowdin's OpenAPI spec: the project's settings, the export setting and the language mapping among
// them, go to its owner, a manager, or a developer only. Under a translator's token, both scripts
// would fall back to defaults in silence.
export async function fetchProject(): Promise<Project> {
  const { data } = (await api('GET', `/projects/${projectId}`)) as {
    data: Omit<Project, 'exportApprovedOnly'> & { readonly exportApprovedOnly?: boolean };
  };

  if (data.exportApprovedOnly == null) {
    throw new Error(
      `CROWDIN_PERSONAL_TOKEN cannot read the settings of Crowdin project ${projectId}. Use a ` +
        `token of the project's owner, a manager, or a developer.`
    );
  }

  return { ...data, exportApprovedOnly: data.exportApprovedOnly };
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
export async function sourceFile(): Promise<{ readonly id: number }> {
  const files = await list<{ readonly id: number; readonly name: string }>(
    `/projects/${projectId}/files`
  );

  const source = files.find(file => file.name == SOURCE_FILE_NAME);

  if (source == null) {
    throw new Error(`No ${SOURCE_FILE_NAME} in Crowdin project ${projectId}.`);
  }

  return source;
}

// Every source string by key, with its Crowdin id, its master's where it duplicates another
// string's text, and its text. The JSON parser stores each key as its quoted source text, so
// `"HallOfFame.Common.BASE_ERROR"` is the identifier of the key `HallOfFame.Common.BASE_ERROR`.
export async function sourceStrings(): Promise<
  Map<string, { readonly id: number; readonly masterId: number; readonly text: string }>
> {
  const source = await sourceFile();

  const strings = await list<{
    readonly id: number;
    readonly masterStringId: number | null;
    readonly identifier: string;
    readonly text: string;
  }>(`/projects/${projectId}/strings?fileId=${source.id}`);

  return new Map(
    strings.map(string => [
      JSON.parse(string.identifier) as string,
      { id: string.id, masterId: string.masterStringId ?? string.id, text: string.text }
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
  const content = await Bun.file(`${LOCALES_DIRECTORY}/${SOURCE_FILE_NAME}`).text();

  const stored = await request('POST', '/storages', content, {
    'content-type': 'application/octet-stream',
    'crowdin-api-filename': SOURCE_FILE_NAME
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

  if (!updated.ok) {
    throw new Error(`Crowdin PUT ${path}: ${updated.status} ${await updated.text()}`);
  }

  // Crowdin's OpenAPI spec answers this update with a 200 only, an unchanged file flagged here.
  return updated.headers.get('crowdin-api-content-status') != 'not-modified';
}

export async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await request(method, path, body == null ? undefined : JSON.stringify(body), {
    'content-type': 'application/json'
  });

  if (!response.ok) {
    throw new Error(`Crowdin ${method} ${path}: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

// Every item of a list endpoint, gathered page by page.
export async function list<T>(path: string): Promise<T[]> {
  const items: T[] = [];
  const separator = path.includes('?') ? '&' : '?';

  for (let offset = 0; ; offset += PAGE_SIZE) {
    // oxlint-disable-next-line no-await-in-loop -- each page's offset follows the previous one.
    const page = (await api('GET', `${path}${separator}limit=${PAGE_SIZE}&offset=${offset}`)) as {
      data: Array<{ data: T }>;
    };

    items.push(...page.data.map(item => item.data));

    if (page.data.length < PAGE_SIZE) {
      return items;
    }
  }
}

// A locale file as the working tree holds it; `readAtRef` reads the same file at a commit.
export async function readLocale(fileName: string): Promise<Record<string, string>> {
  return (await Bun.file(`${LOCALES_DIRECTORY}/${fileName}`).json()) as Record<string, string>;
}

// A file absent from the ref is a locale added since, whose every key then reads as changed. The
// ref's tree listing proves the absence, where a failed read cannot: `cat-file -e` exits 128 for a
// missing path and an unreadable object alike, and reading either as "no previous version" would
// turn one unreadable file into a push of the whole locale.
export async function readAtRef(base: string, fileName: string): Promise<Record<string, string>> {
  const path = `${LOCALES_DIRECTORY}/${fileName}`;
  const revision = `${base}:${path}`;

  if ((await git(['ls-tree', base, '--', path])) == '') {
    return {};
  }

  return JSON.parse(await git(['show', revision])) as Record<string, string>;
}

// A range is valid to `git diff` but not to `git show <ref>:<path>`, which would make every
// baseline read as an absent file, every key read as new, and the whole locale get pushed.
export async function resolveCommit(ref: string): Promise<string> {
  const resolved = await git(['rev-parse', '--verify', `${ref}^{commit}`]).catch(() => null);

  if (resolved == null) {
    throw new Error(`--base ${ref} does not name one commit. A range cannot be a baseline.`);
  }

  return resolved.trim();
}

export async function git(args: readonly string[]): Promise<string> {
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

// The project is configuration, CROWDIN_PROJECT_ID in mise.toml's [env], and the token a secret
// from the environment.
function readProjectId(): number {
  const id = Number(Bun.env.CROWDIN_PROJECT_ID);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(
      `CROWDIN_PROJECT_ID is not set to a Crowdin project ID. Write the project's numeric ID in ` +
        `the [env] section of mise.toml.`
    );
  }

  return id;
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
      `CROWDIN_PERSONAL_TOKEN is not set. Create one with project write scope, under the account ` +
        `of the project's owner, a manager, or a developer, at ` +
        `https://crowdin.com/settings#api-key, then export it or set it in the [env] section of ` +
        `mise.local.toml, which git ignores.`
    );
  }

  return fetch(`${API_URL}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...headers },
    ...(body == null ? {} : { body })
  });
}
