// This barrel is the public C#<->TS binding facade. It lives under `utils/` (a Biome package), so
// symbols re-exported here default to package-private visibility (`noPrivateImports` with
// `defaultVisibility: "package"`). Hooks and commands are reached through the `bindings.*` namespace
// and that is allowed as-is, but the data-shape interfaces are also imported by name from the
// feature areas, so those declarations carry an `@public` tag (Biome resolves named-import
// visibility at the declaration, not at this re-export).

export * from './capture';
export * from './common';
export * from './input-action';
export * from './slideshow';
export * from './vanilla';
