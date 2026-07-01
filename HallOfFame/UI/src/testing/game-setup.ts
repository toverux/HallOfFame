// `bun test --preload` harness that loads the real Cities: Skylines II game UI bundle so that mod
// React components (which `import ... from 'cs2/*'`) can be rendered with @testing-library/react
// against the real game modules, with a binding-value mock so `cs2/api` value bindings return
// configured data and `cs2/l10n` works.
//
// It is wired as a global test preload in `bunfig.toml`. Pure-logic tests (no `cs2/*` runtime
// imports) do not need any of this; the bundle is loaded best-effort, and a failure to load it
// (game not installed, or the injection anchors drifted after a game update) only breaks the
// component tests that actually render game modules, not the pure-function tests.
//
// How it works (reverse-engineered from the bundle):
//   - The bundle is a minified webpack IIFE. bun cannot `import()` it (its hot-reload setters
//     reassign `const` bindings, which bun's transpiler rejects), so it is loaded with indirect
//     `eval` (raw JS handed to JavaScriptCore).
//   - Injection: the bundle's two thin React wrapper modules are patched, so the bundle's own
//     components use this repo's React dependency (allowing using a debug React build).
//     That yields a single React instance shared by mod components, game components, and
//     @testing-library/react, with a dev React (real `act`, hook validation) and no act/jsx shims.
//   - The bundle exposes game modules on `window` (e.g. `window['cs2/api']`); each bare specifier
//     is aliased to its window export via `mock.module`.
//   - The bundle talks to C# through a cohtml `engine` we supply. We implement the native engine
//     hooks so ValueBinding/MapEntry subscribe requests are answered synchronously with configured
//     (or default) values, and command triggers are recorded for assertions.

// biome-ignore-all lint/correctness/noNodejsModules: test harness running under bun, not the mod.
// biome-ignore-all lint/style/noProcessEnv: test harness needs the game install path.

import { mock } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';
import { GlobalRegistrator } from '@happy-dom/global-registrator';

type Dict = Record<string, unknown>;

type Handler = (...args: readonly unknown[]) => void;

/**
 * @public
 * A command trigger recorded by the mock engine, e.g. `hallOfFame.capture.uploadScreenshot`.
 */
export interface RecordedTrigger {
  readonly event: string;
  readonly args: readonly unknown[];
}

const globals = globalThis as unknown as Dict;

// `${group}.${name}` -> value, for ValueBindings.
const valueBindings = new Map<string, unknown>();

// `${group}.${name}` -> (stringified key -> value), for MapEntry bindings.
const mapBindings = new Map<string, Map<string, unknown>>();

// Event name -> registered cohtml handlers.
const handlers = new Map<string, Set<Handler>>();

const recordedTriggers: RecordedTrigger[] = [];

/**
 * @public
 * Configures the value a `bindValue(group, name, default)` binding returns.
 * Call before rendering; after the first render this also live-updates already-subscribed
 * components, but such updates run outside React's `act`, so prefer configuring before rendering.
 */
export function setBinding(group: string, name: string, value: unknown): void {
  const base = `${group}.${name}`;

  valueBindings.set(base, value);

  dispatch(`${base}.update`, value);
}

/**
 * @public
 * Configures a single entry of a MapEntry binding (the kind behind `cs2/ui` input hints).
 * Best-effort: keys are matched by `String(key)`, so bindings keyed by object identity will not
 * match.
 * Unconfigured entries resolve to `null`, which is enough for game widgets to render.
 */
export function setMapBinding(group: string, name: string, key: unknown, value: unknown): void {
  const base = `${group}.${name}`;

  let entries = mapBindings.get(base);

  if (!entries) {
    entries = new Map();
    mapBindings.set(base, entries);
  }

  entries.set(String(key), value);

  dispatch(`${base}.updateMapEntry`, key, value);
}

/**
 * @public
 * Returns the command triggers recorded since the last {@link resetBindings} call.
 */
export function getTriggers(): readonly RecordedTrigger[] {
  return recordedTriggers;
}

/**
 * @public
 * Clears all configured bindings and recorded triggers.
 * Call in an `afterEach` with `cleanup`.
 */
export function resetBindings(): void {
  valueBindings.clear();
  mapBindings.clear();
  recordedTriggers.length = 0;
}

/**
 * Registers the DOM and the mock engine, then loads the game bundle best-effort.
 * The mock engine is installed unconditionally (cheap, harmless to pure tests); only the bundle
 * load is allowed to fail gracefully.
 */
function bootstrap(): void {
  GlobalRegistrator.register();

  // happy-dom does not provide this; the bundle's chart.js module needs it at load.
  globals.CanvasRenderingContext2D = class CanvasRenderingContext2D {};

  // The cohtml engine the bundle binds to. Defining it before load flips the bundle to its
  // "attached" mode; a no-op `BindingsReady` keeps the app from auto-booting (its `whenReady`
  // never fires), so only our test trees render.
  globals.engine = {
    // biome-ignore-start lint/style/useNamingConvention: cohtml's native engine API is PascalCase.
    AddOrRemoveOnHandler: (name: string, fn: Handler): void => addHandler(name, fn),
    RemoveOnHandler: (name: string, fn: Handler): void => removeHandler(name, fn),
    ReleaseOnHandler: (): void => {
      // No-op: this harness never needs to release native handlers.
    },
    BindingsReady: (): void => {
      // No-op on purpose: keeps the app's `whenReady` from firing so it never auto-boots.
    },
    TriggerEvent: triggerEvent
    // biome-ignore-end lint/style/useNamingConvention: cohtml's native engine API is PascalCase.
  };

  try {
    loadGameBundle();
  } catch (error) {
    // Pure-logic tests do not need the bundle, so do not fail the whole run; only component tests
    // that import `cs2/*` at runtime will fail, and with a clearer downstream error.
    // biome-ignore lint/suspicious/noConsole: surfacing why component tests will fail.
    console.warn(
      `[HoF test harness] Game bundle not loaded; component tests will fail. Reason: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Injects this repo's React into the bundle, evaluates it, then aliases the bare game specifiers to
 * the bundle's window exports, and makes `cs2/l10n` usable without the real localization provider.
 */
function loadGameBundle(): void {
  const installPath = process.env.CSII_INSTALLATIONPATH;

  if (!installPath) {
    throw new Error('CSII_INSTALLATIONPATH is not set');
  }

  const bundlePath = join(installPath, 'Cities2_Data', 'Content', 'Game', 'UI', 'index.js');

  // The bundle's two thin React wrapper modules are repointed at this repo's react/jsx-runtime, so
  // the whole tree runs on a single (dev) React instance shared with @testing-library/react.
  const require = createRequire(import.meta.url);

  globals.__TEST_REACT__ = require('react');
  globals.__TEST_JSX__ = require('react/jsx-runtime');

  let source = readFileSync(bundlePath, 'utf8');

  for (const [from, to] of reactInjectionPatches) {
    if (!source.includes(from)) {
      throw new Error(`React injection anchor not found (game updated?): ${from.slice(0, 28)}...`);
    }

    source = source.replace(from, to);
  }

  // Indirect eval hands the raw script to JavaScriptCore; a direct `import()` is rejected by bun.
  // biome-ignore lint/security/noGlobalEval: loading the prebuilt game bundle is the whole point.
  const indirectEval = eval;

  indirectEval(source);

  aliasGameModules();
  overrideLocalization();
}

/** Aliases every bare game specifier the mod imports to the loaded bundle's window export. */
function aliasGameModules(): void {
  // react/react-dom are intentionally absent: the injection above already makes the bundle use this
  // repo's React, so a mod's `import 'react'` is the same instance. Aliasing React via mock.module
  // instead makes react-dom bind to a spread copy and silently no-op on commit.
  const specifiers = [
    'cs2/modding',
    'cs2/api',
    'cs2/bindings',
    'cs2/l10n',
    'cs2/ui',
    'cs2/input',
    'cs2/utils',
    'cohtml/cohtml'
  ];

  for (const specifier of specifiers) {
    const exported = (globals as Dict)[specifier];

    if (exported == null) {
      throw new Error(`Bundle did not export "${specifier}"`);
    }

    mock.module(specifier, () => ({ ...(exported as Dict), default: exported }));
  }
}

/**
 * Overrides the `LocalizationContext` no-provider default so `useLocalization().translate(id,
 * fallback)` returns the fallback (or the id) instead of `null`, without the real, binding-driven
 * localization provider. `unitSettings` is reused from the original default, so `LocalizedNumber`
 * and friends keep working.
 */
function overrideLocalization(): void {
  const { getModule } = globals['cs2/modding'] as {
    getModule: (m: string, e: string) => unknown;
  };

  const context = getModule(
    'game-ui/common/localization/localization.tsx',
    'LocalizationContext'
  ) as { _currentValue?: Dict; _currentValue2?: Dict };

  const originalDefault = context._currentValue ?? context._currentValue2 ?? {};

  const value = {
    translate: (id: string, fallback?: string | null): string => fallback ?? id,
    unitSettings: originalDefault.unitSettings
  };

  // React stores a context's no-provider default in both these slots.
  context._currentValue = value;
  context._currentValue2 = value;
}

function addHandler(name: string, fn: Handler): void {
  let set = handlers.get(name);

  if (!set) {
    set = new Set();
    handlers.set(name, set);
  }

  set.add(fn);
}

function removeHandler(name: string, fn: Handler): void {
  handlers.get(name)?.delete(fn);
}

function dispatch(name: string, ...args: readonly unknown[]): void {
  const set = handlers.get(name);

  if (set) {
    for (const fn of [...set]) {
      fn(...args);
    }
  }
}

/**
 * Receives every `engine.trigger(...)` from the bundle. Answers binding subscribe requests with
 * configured (or default) values and records everything else as a command trigger.
 */
function triggerEvent(name: string, ...args: readonly unknown[]): void {
  if (name.endsWith('.subscribe')) {
    const base = name.slice(0, -'.subscribe'.length);

    // When unconfigured, do nothing: the binding keeps its `bindValue` default. Only a default-less
    // binding throws, which is the intended "you forgot to configure this" signal.
    if (valueBindings.has(base)) {
      dispatch(`${base}.update`, valueBindings.get(base));
    }

    return;
  }

  if (name.endsWith('.subscribeMapEntry')) {
    const base = name.slice(0, -'.subscribeMapEntry'.length);
    const [key] = args;
    const entries = mapBindings.get(base);
    const stringKey = String(key);

    // `null` is a safe default that keeps game widgets (e.g., input hints) from throwing.
    const value = entries?.has(stringKey) ? entries.get(stringKey) : null;

    dispatch(`${base}.updateMapEntry`, key, value);

    return;
  }

  // Ignore unsubscribe/patch churn; everything else is a command worth asserting on.
  if (!(name.endsWith('.unsubscribe') || name.endsWith('.unsubscribeMapEntry'))) {
    recordedTriggers.push({ event: name, args });
  }
}

const reactInjectionPatches: ReadonlyArray<readonly [string, string]> = [
  // react
  [
    '6540:(e,t,n)=>{"use strict";e.exports=n(5287)}',
    '6540:(e,t,n)=>{"use strict";e.exports=globalThis.__TEST_REACT__}'
  ],
  // react/jsx-runtime
  [
    '4848:(e,t,n)=>{"use strict";e.exports=n(1020)}',
    '4848:(e,t,n)=>{"use strict";e.exports=globalThis.__TEST_JSX__}'
  ]
];

// Entry point: run after all module-level declarations above are initialized.
bootstrap();
