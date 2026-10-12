# Dependency updates

Packages a dependency sweep deliberately left behind, and what would let them move.
An entry stays until its blocking condition is gone; the next sweep re-evaluates it and says so.

## react, react-dom, @types/react, @types/react-dom

- **Skipped**: 18.3.1 (types 18.3.31 / 18.3.7) → 19.3.0 (types 19.3.0 / 19.3.0)
- **Reason**: React is a `window` external (`windowExternals` in `HallOfFame/UI/build.ts`), so the mod binds to the React the game supplies at runtime rather than to its own copy. The game ships 18.3.1, and the packages here only exist to type and compile against it.
- **Blocked until**: Cities: Skylines II itself ships a different React. The pin follows the game, never the registry.
- **Date**: 2026-10-11

## sass

- **Skipped**: 1.78.0 → 1.105.1
- **Reason**: Versions above 1.78 emit CSS Color 4 syntax wherever it is shorter, which Coherent Gameface cannot parse. The change is invisible to a changelog, which has no reason to call browser-valid output breaking, and invisible to the build, which compiles happily either way; it only shows up rendered in the game.
- **Blocked until**: Gameface parses CSS Color 4, or sass grows a way to hold its output to the older syntax. Treat this as permanent.
- **Date**: 2026-10-11
