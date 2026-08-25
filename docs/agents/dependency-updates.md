# Dependency updates

Packages a dependency sweep deliberately left behind, and what would let them move.
An entry stays until its blocking condition is gone; the next sweep re-evaluates it and says so.

## react, react-dom, @types/react, @types/react-dom

- **Skipped**: 18.3.1 (types 18.3.31 / 18.3.7) → 19.2.8 (types 19.2.18 / 19.2.5)
- **Reason**: React is a webpack external (`HallOfFame/UI/webpack.config.js`, `'react': 'React'`), so the mod binds to the React the game supplies at runtime rather than to its own copy. The game ships 18.3.1, and the packages here only exist to type and compile against it.
- **Blocked until**: Cities: Skylines II itself ships a different React. The pin follows the game, never the registry.
- **Date**: 2026-08-25

## typescript

- **Skipped**: 6.0.3 → 7.0.2
- **Reason**: TypeScript 7 is the native Go port, and `ts-loader` does not support its compiler API in type-checking mode, which is how the webpack build uses it. The maintainer's position on `TypeStrong/ts-loader#1702`: "It's not only that the API has changed, but that the new API is not even stable yet. The API will be part of 7.1". Every other TS 7 change was checked against this repo and none of it bites: the removed compiler options all miss the current `tsconfig.json`, and the `types` and `noUncheckedSideEffectImports` default flips are already satisfied.
- **Blocked until**: `ts-loader` ships TS 7 support, or the build stops type-checking through it. Swapping `ts-loader` for a transpile-only loader would also lift the block, since `isolatedModules` is already on and nothing here needs cross-file type info to emit.
- **Date**: 2026-08-25

## sass, sass-embedded

- **Skipped**: 1.78.0 → 1.103.1
- **Reason**: Versions above 1.78 emit CSS Color 4 syntax wherever it is shorter, which Coherent Gameface cannot parse. The change is invisible to a changelog, which has no reason to call browser-valid output breaking, and invisible to the build, which compiles happily either way; it only shows up rendered in the game.
- **Blocked until**: Gameface parses CSS Color 4, or sass grows a way to hold its output to the older syntax. Treat this as permanent.
- **Date**: 2026-08-25
