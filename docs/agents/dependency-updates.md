# Dependency updates

Packages a dependency sweep deliberately left behind, and what would let them move.
An entry stays until its blocking condition is gone; the next sweep re-evaluates it and says so.
A declined adoption stays out until its reason no longer holds, and a docs pass entry records the last release whose notes were read, so the next sweep reads on from it.

## react, react-dom, @types/react, @types/react-dom

- **Skipped**: 18.3.1 (types 18.3.31 / 18.3.7) → 19.3.1 (types 19.3.0 / 19.3.0)
- **Reason**: React is a `window` external (`windowExternals` in `HallOfFame/UI/build.ts`), so the mod binds to the React the game supplies at runtime rather than to its own copy. The game ships 18.3.1, and the packages here only exist to type and compile against it.
- **Blocked until**: Cities: Skylines II itself ships a different React. The pin follows the game, never the registry.
- **Date**: 2026-10-23

## sass

- **Skipped**: 1.78.0 → 1.107.1
- **Reason**: Versions above 1.78 emit CSS Color 4 syntax wherever it is shorter, which Coherent Gameface cannot parse. The change is invisible to a changelog, which has no reason to call browser-valid output breaking, and invisible to the build, which compiles happily either way; it only shows up rendered in the game.
- **Blocked until**: Gameface parses CSS Color 4, or sass grows a way to hold its output to the older syntax. Treat this as permanent.
- **Date**: 2026-11-05

## change-case

- **Skipped**: 4.1.2 → 5.4.4
- **Reason**: `HallOfFame/UI/build.ts` names the CSS module exports with change-case so they match the `.module.scss.d.ts` typed-scss-modules generates with its own change-case 4. Version 5 drops `camelCaseTransformMerge` and splits around digits differently, so the bundle's names would drift from the declared ones.
- **Blocked until**: typed-scss-modules depends on change-case 5.
- **Date**: 2026-11-05

## bun lint

- **Skipped**: oxlint and oxlint-tsgolint → `bun lint`
- **Reason**: `bun lint` exists only in canary builds, and it lacks the `jsdoc/*` rules and `eslint(require-await)` the shared configuration enables.
- **Blocked until**: a stable bun release ships `bun lint`. Then it replaces `check:oxlint`, `check:agents:oxlint`, `fix:oxlint` and the lefthook job, as `bun fmt` replaced oxfmt.
- **Date**: 2026-11-05

## bun docs pass

- **Read up to**: 1.4.4
- **Date**: 2026-11-05

## bun: ReadableStream `text()`

- **Declined adoption**: `child.stdout.text()` in place of `new Response(child.stdout).text()` in the scripts reading a child's output.
- **Reason**: The trial failed the type check: `@types/bun` 1.4.4 does not declare `text()` on `ReadableStream`, although the runtime has it.
- **Date**: 2026-11-05

## bun: `Bun.Image` palette PNG

- **Declined adoption**: `Bun.Image` `.png({ palette: true })` in place of pngquant-bin in `images:optimize`.
- **Reason**: The trial on six in-game screenshots gave files 20 to 40% smaller than pngquant's, but visibly worse: 27 to 32 dB PSNR dithered against pngquant's 42 to 44 dB, a coarse checkerboard over gradients, and blotchy posterization undithered.
- **Date**: 2026-11-05

## bun: security scanner, JSONC `package.json`

- **Declined adoption**: `[install.security] scanner` in `bunfig.toml`; comments in `package.json`.
- **Reason**: Declined by the user, with no reason given.
- **Date**: 2026-11-05

## mise: committed `mise.lock`

- **Declined adoption**: a `mise.lock` with per-platform checksums for bun, dotnet and oxipng.
- **Reason**: Declined by the user, with no reason given.
- **Date**: 2026-11-05
