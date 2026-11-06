import { getModule } from 'cs2/modding';
import { logError } from './ui-helpers';

/**
 * @see getClassesModule
 */
const ignoreResolveErrorsFor = new Set<string>();

/**
 * Resolve a scoped Vanilla class name (ex. "vanilla-name_k91") from an exposed scss module,
 * ensuring the desired class(es) are indeed in that module, hence ensuring type safety and correct
 * error handling.
 * A missing module or class will show an error in the UI the first time it fails to resolve, then
 * it will be ignored to avoid spamming the user.
 * A missing class will be resolved in the resulting map with a "_missing" suffix.
 *
 * @param module Path of the vanilla module.
 * @param classNames Classes to ensure are in the module, ensuring compilation and runtime
 *   type-safety.
 */
export function getClassesModule<const TClassNames extends readonly string[]>(
  module: string,
  classNames: TClassNames
): Record<TClassNames[number], string> {
  let classes: Record<string, string>;

  // Each report opens a game error dialog (logError), so a missing module's report stands for all
  // of its classes.
  let reportMissingClasses = true;

  try {
    // A copy: the registry hands out the game's own classes object, which vanilla components style
    // with (game UI bundle, the module's `classes` getter), so the fallbacks below stay off it.
    classes = { ...(getModule(module, 'classes') as Record<string, string>) };
  } catch {
    classes = {};
    reportMissingClasses = false;

    reportOnce(module, `Could not find module "${module}".`);
  }

  for (const className of classNames) {
    if (!(className in classes)) {
      classes[className] = `${className}_missing`;

      if (reportMissingClasses) {
        reportOnce(
          `${module}#${className}`,
          `Could not find class "${className}" in module "${module}".`
        );
      }
    }
  }

  return classes;
}

/**
 * Resolve a Vanilla module export, ensuring the export exists and is of the correct type.
 * A missing module or export will show an error in the UI the first time it fails to resolve, then
 * it will be ignored to avoid spamming the user.
 * A missing export will resolve to the provided fallback value.
 *
 * @param module Path of the vanilla module.
 * @param exportName Symbol export name.
 * @param guard Type guard to ensure the export is of the correct type.
 * @param fallback Fallback value to use if the export is missing or invalid.
 */
export function getModuleExport<TExport>(
  module: string,
  exportName: string,
  guard: (value: unknown) => value is TExport,
  fallback: TExport
): TExport {
  try {
    const exported = getModule(module, exportName) as unknown;

    if (guard(exported)) {
      return exported;
    }

    reportOnce(
      `${module}#${exportName}`,
      `Export "${exportName}" in module "${module}" did not pass type guard.`
    );

    return fallback;
  } catch {
    // Keyed by export: the registry throws for each missing export on its own (game UI bundle,
    // `Module ${e}@${t} was not found.`), and each deserves its report.
    reportOnce(
      `${module}#${exportName}`,
      `Could not find export "${exportName}" in module "${module}".`
    );

    return fallback;
  }
}

/**
 * Type guard for a vanilla component export: a memoized component is an object, not a function, so
 * the guard can only check that this is something React could render.
 */
export function isRenderable(value: unknown): boolean {
  return typeof value == 'function' || (value != null && typeof value == 'object');
}

/**
 * Transforms a space-separated list of class names into a query selector, i.e. "class1 class2
 * class3" -> ".class1.class2.class3".
 */
export function selector(classNames: string): string {
  return `.${classNames.replaceAll(' ', '.')}`;
}

/**
 * Shows an error in the UI the first time the given key fails to resolve, then ignores it.
 */
function reportOnce(key: string, message: string): void {
  if (!ignoreResolveErrorsFor.has(key)) {
    logError(new Error(message));

    ignoreResolveErrorsFor.add(key);
  }
}
