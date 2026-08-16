// Version: 1.0.0

// oxlint-disable unicorn/no-process-exit -- the hook protocol communicates via exit codes.

// PostToolUse hook: warns the agent when a file it just edited carries an em dash outside the
// prose documents allowed to use one, per the general-code-style rule.
// Exits with code 2 so the warning (offending line numbers) is fed back to the agent to fix.
//
// Bun is the required runtime: it runs this TypeScript file directly, and its file APIs read the
// payload on stdin and the edited file.
//
// One optional flag configures the check:
//   --allow-extensions md,txt   Comma-separated extensions exempt from the check (no dots,
//                               case-insensitive), defaulting to `md`.
// Every other file is checked, extension or none, so a new file type is covered by default rather
// than silently skipped. Pass an empty value to check every file, prose included.
//
// Wire it as a PostToolUse hook matched on `Edit|Write|MultiEdit`, its command on a single line:
//   bun "$CLAUDE_PROJECT_DIR/hooks/check-em-dashes.ts" --allow-extensions md,txt

const defaultAllowedExtensions = 'md';

// The character the hook exists to find, written as an escape so this file passes its own check.
const emDash = '\u2014';

// The conditions worth tolerating are handled where they arise (an absent or unparseable payload,
// an unreadable file), so nothing wraps this call: a throw from here on is a bug in the hook, and
// Bun's own exit 1 puts the stack on stderr where it can be seen. Only exit 2 blocks the tool, so
// a loud crash still lets the edit through.
await run();

async function run(): Promise<void> {
  const allowedArg = argValue(Bun.argv.slice(2), '--allow-extensions');
  const allowed = parseExtensions(allowedArg ?? defaultAllowedExtensions);
  const filePath = filePathOf(await readPayload());

  if (filePath == null) {
    return;
  }

  const lowerPath = filePath.toLowerCase();

  if (allowed.some(extension => lowerPath.endsWith(extension))) {
    return;
  }

  // A single read doubles as the existence check (the file may be gone by the time the hook runs).
  const content = await tryReadFile(filePath);

  if (content == null) {
    return;
  }

  // 1-based line numbers carrying at least one em dash.
  // Lines split on LF with any trailing CR dropped, so CRLF checkouts report like LF ones.
  const offending: number[] = [];

  for (const [index, line] of content.split(/\r?\n/u).entries()) {
    if (line.includes(emDash)) {
      offending.push(index + 1);
    }
  }

  if (offending.length == 0) {
    return;
  }

  const [noun, verb, pronoun] =
    offending.length == 1 ? ['line', 'carries', 'it'] : ['lines', 'carry', 'them'];

  await Bun.write(
    Bun.stderr,
    `${filePath}: ${offending.length} ${noun} ${verb} an em dash (${emDash}), which only prose ` +
      `documents may use. Offending ${noun}: ${offending.join(', ')}.\n` +
      `Replace ${pronoun} with a comma, semicolon, colon, or "--", or reword the sentence.\n`
  );

  process.exit(2);
}

// Extensions become the dotted suffixes a path is matched against, so `ts` never matches `.mts`.
// A leading dot is stripped before that dot is added back: `.md` in the config is a natural way to
// write the flag, and left alone it would yield `..md` and match nothing.
// An empty list is honored rather than reported: exempting nothing checks everything, which is a
// stricter check and not the silent pass that an empty list would be in an opt-in hook.
function parseExtensions(source: string): readonly string[] {
  return source
    .split(',')
    .map(extension => extension.trim().replace(/^\./u, '').toLowerCase())
    .filter(extension => extension != '')
    .map(extension => `.${extension}`);
}

// A flag's value is the next argument. An empty one is meaningful here (exempt nothing), so only a
// flag given without any following argument falls back to the default.
function argValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);

  return index == -1 ? null : (args[index + 1] ?? null);
}

// The hook payload is JSON on stdin. A harness that invokes the hook with no stdin, or with
// something that is not JSON, gets no check rather than a crash: the hook has nothing to say about
// a file it cannot identify.
async function readPayload(): Promise<unknown> {
  try {
    return await Bun.stdin.json();
  } catch {
    return null;
  }
}

async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await Bun.file(filePath).text();
  } catch {
    return null;
  }
}

function filePathOf(payload: unknown): string | null {
  if (typeof payload != 'object' || payload == null) {
    return null;
  }

  const toolInput = (payload as Record<string, unknown>).tool_input;

  if (typeof toolInput != 'object' || toolInput == null) {
    return null;
  }

  const filePath = (toolInput as Record<string, unknown>).file_path;

  return typeof filePath == 'string' && filePath !== '' ? filePath : null;
}
