// Version: 3.0.0

// oxlint-disable unicorn/no-process-exit -- the hook protocol communicates via exit codes.

// PostToolUse hook: warns the agent when a source file it just edited has lines exceeding the
// limit from the general-code-style rule.
// Exits with code 2 so the warning (offending line numbers) is fed back to the agent to fix.
//
// Bun is the required runtime: it runs this TypeScript file directly, and its file APIs read the
// payload on stdin and the edited file.
//
// The limit's exceptions live in the general-code-style rule; the ones a regex can recognize --
// URLs, and whatever --suppressions names -- are exempted mechanically, and the judgment-call
// exceptions are named in the warning for the agent to weigh.
//
// One required flag and one optional one configure the check:
//   --extensions md,ts,tsx   Comma-separated extensions to check (no dots, case-insensitive).
//   --suppressions <regex>   ECMAScript unicode-mode regex source; matching lines are exempt.
//                            Optional, and added to the built-in exemptions rather than replacing
//                            them, so no configuration can turn a built-in one off.
// Naming no extensions, or a --suppressions pattern that does not compile, is a hard failure: the
// hook checks nothing and exits with an agent-readable error and an example fix, on every edit
// until the command is corrected. A misconfigured checker that looks like a passing one is the
// one failure worth blocking on.
//
// Wire it as a PostToolUse hook matched on `Edit|Write|MultiEdit`, its command on a single line:
//   bun "$CLAUDE_PROJECT_DIR/hooks/check-line-length.ts"
//   --extensions md,ts,tsx --suppressions "oxlint-disable|@ts-expect-error"

const maxLength = 100;
const flagNames = new Set(['--extensions', '--suppressions']);

// Always in effect, whatever --suppressions says. A URL has no split that leaves it usable, so a
// line carrying one is over the limit for a reason no rewrite fixes. The pattern is an RFC 3986
// scheme followed by an authority, which covers https, file, and git+ssh alike; schemes with no
// authority (`mailto:`, `data:`) are left to --suppressions, being rarer and easier to false-match.
const builtinSuppressions = /[a-z][a-z0-9+.-]*:\/\//u;

// Built on first use and kept for the rest of the process: constructing a segmenter initializes
// ICU segmentation data, and a file whose every line fits -- the common case for a hook that runs
// after each edit -- never needs one. Declared above the entry call below, since `let` stays in the
// temporal dead zone until its declaration is reached.
let graphemes: Intl.Segmenter | undefined;

// The conditions worth tolerating are handled where they arise (an absent or unparseable payload,
// an unreadable file), so nothing wraps this call: a throw from here on is a bug in the hook, and
// Bun's own exit 1 puts the stack on stderr where it can be seen. Only exit 2 blocks the tool, so
// a loud crash still lets the edit through.
await run();

async function run(): Promise<void> {
  const args = Bun.argv.slice(2);
  const extensionsArg = argValue(args, '--extensions');
  const suppressionsArg = argValue(args, '--suppressions');

  // An extension list that is missing, empty, or only separators would match no file and check
  // nothing, which reads as a clean pass on every edit. That is the one failure a hook must never
  // have, so it is surfaced rather than honored: exit 2 feeds the fix back to the agent.
  const extensions = extensionsArg == null ? [] : parseExtensions(extensionsArg);

  if (extensions.length == 0) {
    await Bun.write(
      Bun.stderr,
      `check-line-length: --extensions names no extension to check. ` +
        `Set it in the hook command in .claude/settings.json, for example:\n` +
        `--extensions md,ts,tsx --suppressions 'oxlint-disable|@ts-expect-error'\n`
    );

    process.exit(2);
  }

  // A pattern that does not compile is a typo in the hook command, not a laxer check: carrying on
  // without it would report the very lines it was written to exempt, so it fails like a missing
  // extension list.
  // A blank pattern is the one absent-like value that is not a typo, and means "add nothing":
  // compiling `''` would produce a regex matching every line, exempting whole files and disabling
  // the check. Only the blankness test trims, since space is meaningful inside a regex.
  const configuredSource = suppressionsArg?.trim() ? suppressionsArg : null;
  const configured = configuredSource == null ? null : compileSuppression(configuredSource);

  if (configuredSource != null && configured == null) {
    await Bun.write(
      Bun.stderr,
      `check-line-length: --suppressions is not a valid regex, so nothing was checked. ` +
        `Fix the pattern in the hook command in .claude/settings.json. It was: ${configuredSource}\n`
    );

    process.exit(2);
  }

  const suppressions =
    configured == null ? [builtinSuppressions] : [builtinSuppressions, configured];

  const filePath = filePathOf(await readPayload());

  if (filePath == null) {
    return;
  }

  const lowerPath = filePath.toLowerCase();

  if (!extensions.some(extension => lowerPath.endsWith(extension))) {
    return;
  }

  // A single read doubles as the existence check (the file may be gone by the time the hook runs).
  const content = await tryReadFile(filePath);

  if (content == null) {
    return;
  }

  // 1-based line numbers exceeding the limit, skipping exempt lines
  // Lines split on LF with any trailing CR dropped, so CRLF checkouts measure like LF ones.
  const offending: number[] = [];

  for (const [index, line] of content.split(/\r?\n/u).entries()) {
    const over = line.length > maxLength && graphemeLength(line) > maxLength;

    if (over && !suppressions.some(pattern => pattern.test(line))) {
      offending.push(index + 1);
    }
  }

  if (offending.length == 0) {
    return;
  }

  const [noun, verb] = offending.length == 1 ? ['line', 'exceeds'] : ['lines', 'exceed'];

  await Bun.write(
    Bun.stderr,
    `${filePath}: ${offending.length} ${noun} ${verb} the ${maxLength}-character limit. ` +
      `Offending ${noun}: ${offending.join(', ')}.\n` +
      `Wrap or shorten, unless excess is unsplittable string or .md file intended for agents.\n`
  );

  process.exit(2);
}

// Extensions become the dotted suffixes a path is matched against, so `ts` never matches `.mts`.
// A leading dot is stripped before that dot is added back: `.ts` in the config is a natural way to
// write the flag, and left alone it would yield `..ts` and match nothing.
function parseExtensions(source: string): readonly string[] {
  return source
    .split(',')
    .map(extension => extension.trim().replace(/^\./u, '').toLowerCase())
    .filter(extension => extension != '')
    .map(extension => `.${extension}`);
}

// The configured pattern stays its own regex beside the built-ins rather than being spliced into
// their source, so it cannot reshape a built-in by pairing an alternation or a group across a seam.
function compileSuppression(source: string): RegExp | null {
  try {
    return new RegExp(source, 'u');
  } catch {
    return null;
  }
}

// A flag's value is the next argument, unless that argument is one of this hook's own flags:
// swallowing one would leave the real flag unset while looking configured, silently checking the
// wrong extensions or dropping a suppression. Only those two names are excluded, since a
// suppressions pattern may legitimately start with `--` (the line-comment marker in SQL and Lua).
function argValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);
  const value = index == -1 ? null : (args[index + 1] ?? null);

  return value == null || flagNames.has(value) ? null : value;
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

// Grapheme clusters are the columns an editor shows, so a line already over the limit in UTF-16
// units (where a surrogate pair counts as 2) is re-measured in them before it is reported.
function graphemeLength(line: string): number {
  graphemes ??= new Intl.Segmenter();

  return [...graphemes.segment(line)].length;
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
