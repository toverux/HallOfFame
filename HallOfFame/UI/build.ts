// oxlint-disable no-console -- a CLI talks on stdout.
// oxlint-disable import/no-nodejs-modules -- a build script runs on Bun, not in the game.

// Builds the UI with Bun.build and deploys it to the game's Mods folder.
// It reproduces the game's module contract: `<id>.mjs`, an ES module whose `default` and `hasCSS`
// exports src/index.tsx declares, `<id>.css` beside it, images under `images/` served from
// `coui://ui-mods/`, game modules resolved from `window`, and the manifest banner on top.
//
// Run it through `mise build:ui`, or `mise dev` to rebuild on every change under src/.

import assert from 'node:assert/strict';
import { mkdir, rm, watch } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
// On the major typed-scss-modules depends on (4), so exports match the .d.ts names: change-case 5
// drops camelCaseTransformMerge and splits around digits differently.
import { camelCase, camelCaseTransformMerge } from 'change-case';
import postcss from 'postcss';
import postcssModules from 'postcss-modules';
import { compile as compileSass } from 'sass';
import mod from './mod.json' with { type: 'json' };

const localModsPath = process.env.CSII_LOCALMODSPATH;

if (!localModsPath) {
  throw new Error(
    `CSII_LOCALMODSPATH environment variable is not set, ` +
      `ensure the CSII Modding Toolchain is installed correctly.`
  );
}

// The toolchain deploys the DLL to the same folder, its DeployDir.
const outputDirectory = path.join(localModsPath, mod.id);

const sourceDirectory = path.join(import.meta.dir, 'src');

// The csproj `Version` is the mod's single version source. The game parses the banner's version as
// a `System.Version`.
const csprojPath = path.join(import.meta.dir, '..', `${mod.id}.csproj`);
const version = /<Version>(?<version>[^<]+)<\/Version>/u.exec(await Bun.file(csprojPath).text())
  ?.groups?.version;

if (!version) {
  throw new Error(`No <Version> found in ${csprojPath}.`);
}

// The modules the game exposes as properties of `window`, by import specifier.
const windowExternals: ReadonlyMap<string, string> = new Map([
  ['react', 'React'],
  ['react-dom', 'ReactDOM'],
  ['cs2/modding', 'cs2/modding'],
  ['cs2/api', 'cs2/api'],
  ['cs2/bindings', 'cs2/bindings'],
  ['cs2/l10n', 'cs2/l10n'],
  ['cs2/ui', 'cs2/ui'],
  ['cs2/input', 'cs2/input'],
  ['cs2/utils', 'cs2/utils'],
  ['cohtml/cohtml', 'cohtml/cohtml']
]);

// Debounces the burst of events one save raises into a single rebuild.
const REBUILD_DELAY_MS = 150;

// The class names a CSS module cannot export: the words typed-scss-modules leaves out of the .d.ts,
// where tsc would only report a missing property, and `eval` and `arguments`, which a module cannot
// bind with `export const`.
const reservedWords: ReadonlySet<string> = new Set(
  `arguments await break case catch class const continue debugger default delete do else enum eval
  export extends false finally for function if implements import in instanceof interface let new
  null package private protected public return static super switch this throw true try typeof var
  void while with yield`.split(/\s+/u)
);

const banner = `/*
 * Cities: Skylines II UI Module
 *
 * Id: ${mod.id}
 * Author: ${mod.author}
 * Version: ${version}
 * Dependencies: ${mod.dependencies.join(',')}
 */`;

if (process.argv.includes('--watch')) {
  let building = rebuild(Promise.resolve());
  let rebuildTimer: Timer | undefined;

  // Queues each rebuild behind the previous one, so two builds never write the output at once.
  const queueRebuild = (): void => {
    building = rebuild(building);
  };

  for await (const { filename } of watch(sourceDirectory, { recursive: true })) {
    // The generated `.module.scss.d.ts` sit beside their stylesheets but never reach the bundle.
    if (filename?.endsWith('.d.ts')) {
      continue;
    }

    clearTimeout(rebuildTimer);

    rebuildTimer = setTimeout(queueRebuild, REBUILD_DELAY_MS);
  }
} else {
  process.exitCode = (await bundle()) ? 0 : 1;
}

// Builds once the previous build settled, and logs a failure rather than ending the watcher.
async function rebuild(previousBuild: Promise<void>): Promise<void> {
  await previousBuild;

  try {
    await bundle();
  } catch (error) {
    console.error(error);
  }
}

async function bundle(): Promise<boolean> {
  const entryPoint = path.join(sourceDirectory, 'index.tsx');

  // The scoped CSS of each `.module.scss`, by path, filled by the Sass plugin.
  const stylesheets = new Map<string, string>();

  const result = await Bun.build({
    entrypoints: [entryPoint],
    target: 'browser',
    format: 'esm',
    minify: true,
    banner,
    // Selects the production JSX runtime (jsx, not jsxDEV), as the game ships production React.
    define: { 'process.env.NODE_ENV': '"production"' },
    publicPath: 'coui://ui-mods/',
    naming: { asset: 'images/[name].[ext]' },
    plugins: [windowExternalsPlugin(), sassModulesPlugin(stylesheets)],
    metafile: true,
    // Reports a broken source through `result.logs`, which keeps the watcher alive.
    throw: false
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }

    return false;
  }

  const js = result.outputs.find(output => output.kind == 'entry-point');
  const images = result.outputs.filter(output => output.kind == 'asset');

  if (!js) {
    console.error(`Bun.build produced no JS entry point.`);

    return false;
  }

  assert.ok(result.metafile);

  const order = evaluationOrder(result.metafile, entryPoint);

  // A compiled module the evaluation order misses would ship without its styles.
  const unplaced = [...stylesheets.keys()].filter(modulePath => !order.includes(modulePath));

  if (unplaced.length > 0) {
    console.error(
      `build.ts bug: evaluationOrder() missed these compiled stylesheets, their CSS would not ` +
        `ship: ${unplaced.join(', ')}.`
    );

    return false;
  }

  // Concatenated in the order the modules evaluate, so of two rules of equal specificity, the one
  // from the module imported later wins. Empty for a mod with no styles.
  const css = order.flatMap(modulePath => stylesheets.get(modulePath) ?? []).join('\n');

  // The C# build deploys to the same folder: clear only what this build owns.
  await rm(path.join(outputDirectory, 'images'), { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  await Promise.all([
    Bun.write(path.join(outputDirectory, `${mod.id}.mjs`), js),
    // Written even when empty: the entry point declares `hasCSS = true`, and a missing stylesheet
    // hangs the game's module loader for every mod.
    Bun.write(path.join(outputDirectory, `${mod.id}.css`), css),
    // The minifier keeps the `/*!` notices but drops React's `@license` one, shipped here instead.
    Bun.write(
      path.join(outputDirectory, `${mod.id}.mjs.LICENSE.txt`),
      Bun.file(path.join(import.meta.dir, '../../node_modules/react/LICENSE'))
    ),
    ...images.map(image => Bun.write(path.join(outputDirectory, image.path), image))
  ]);

  console.log(`Built ${mod.id} to ${outputDirectory} (${images.length} images).`);

  return true;
}

function windowExternalsPlugin(): Bun.BunPlugin {
  const specifiers = [...windowExternals.keys()]
    .map(specifier => RegExp.escape(specifier))
    .join('|');

  return {
    name: 'window-externals',
    setup(build) {
      build.onResolve({ filter: new RegExp(`^(?:${specifiers})$`, 'u') }, args => ({
        path: args.path,
        namespace: 'window-external'
      }));

      build.onLoad({ filter: /.*/u, namespace: 'window-external' }, args => ({
        contents: `module.exports = window[${JSON.stringify(windowExternals.get(args.path))}];`,
        loader: 'js'
      }));
    }
  };
}

// Lists a module graph's files in evaluation order: each one after the modules it imports.
function evaluationOrder(metafile: Bun.BuildMetafile, entryPoint: string): string[] {
  const visited = new Set<string>();
  const order: string[] = [];

  // The metafile keys its inputs by relative POSIX paths, on Windows too.
  visit(path.relative('.', entryPoint).replaceAll(path.sep, '/'));

  return order.map(modulePath => path.resolve(modulePath));

  function visit(modulePath: string): void {
    if (visited.has(modulePath)) {
      return;
    }

    visited.add(modulePath);

    for (const { path: importPath } of metafile.inputs[modulePath]?.imports ?? []) {
      visit(importPath);
    }

    order.push(modulePath);
  }
}

// Every reference to another stylesheet (`composes` or `@value` from a file, `:import`) loads it
// here. postcss-modules would read that file raw, and its SCSS would ship as is.
class CrossFileImportLoader {
  public fetch(file: string, relativeTo: string): never {
    throw new Error(
      `${relativeTo}: ${file} is imported from CSS, which would ship it uncompiled. ` +
        `Import both modules from TSX and set both classes instead.`
    );
  }
}

// Compiles each `.module.scss` with Sass and scopes its classes with postcss-modules, keeping the
// CSS out of Bun's own CSS bundler: it rewrites declarations into shorthands Gameface ignores, such
// as `inset` and `flex-flow`.
// The module exports each class under its camelCase name only, the names the generated
// `.module.scss.d.ts` declare, and leaves its CSS in `stylesheets` for `bundle()` to concatenate.
// What this CSS path cannot ship fails the build, naming the cause.
function sassModulesPlugin(stylesheets: Map<string, string>): Bun.BunPlugin {
  return {
    name: 'sass-modules',
    setup(build) {
      build.onLoad({ filter: /\.(?:s[ac]ss|css)$/u }, async args => {
        // Bun would otherwise copy it to images/ as a file asset, its styles applied nowhere.
        if (!args.path.endsWith('.module.scss')) {
          throw new Error(
            `${args.path}: only CSS modules are bundled, rename it to *.module.scss.`
          );
        }

        let classes: Record<string, string> = {};

        const { css } = await postcss([
          postcssModules({
            // The `hof-` prefix keeps the `[class^="…"]` selectors aimed at vanilla internals off
            // the mod's own classes.
            generateScopedName: 'hof-[local]_[hash:base64:3]',
            // The names the generated .d.ts declare: postcss-modules' own camelCaseOnly splits
            // after a digit (`icon2x` exports as `icon2X`), leaving the import undefined.
            localsConvention: className =>
              camelCase(className, { transform: camelCaseTransformMerge }),
            getJSON: (_, json) => {
              classes = json;
            },
            Loader: CrossFileImportLoader
          })
        ]).process(compileSass(args.path, { style: 'compressed' }).css, { from: args.path });

        // The generated .d.ts omit most of these, so fail here with the cause.
        const reservedNames = Object.keys(classes).filter(name => reservedWords.has(name));

        if (reservedNames.length > 0) {
          throw new Error(
            `${args.path}: rename the classes exported as reserved words: ` +
              `${reservedNames.join(', ')}.`
          );
        }

        // Bun never sees this CSS, so a relative `url()` would ship as is, pointing at no file.
        const relativeUrl = /url\(\s*(?!['"]?(?:[a-z][\w+.-]*:|#))[^)]*\)/iu.exec(css)?.[0];

        if (relativeUrl) {
          throw new Error(
            `${args.path}: ${relativeUrl} is not deployed. Import the asset from TSX and set it ` +
              `in a style instead: the build deploys imported assets under coui://ui-mods/images/.`
          );
        }

        stylesheets.set(args.path, css);

        return {
          contents: Object.entries(classes)
            .map(([name, scopedName]) => `export const ${name} = ${JSON.stringify(scopedName)};`)
            .join('\n'),
          loader: 'js'
        };
      });
    }
  };
}
