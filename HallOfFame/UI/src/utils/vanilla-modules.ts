import { getModule } from 'cs2/modding';
import { logError } from './ui-helpers';

/** @see getClassesModule */
const ignoreResolveErrorsFor = new Set<string>();

/**
 * Resolve a scoped Vanilla class name (ex. "vanilla-name_k91") from an exposed scss module,
 * ensuring the desired class(es) are indeed in that module, hence ensuring type safety and correct
 * error handling.
 * A missing module or class will show an error in the UI the first time it fails to resolve, then
 * it will be ignored to avoid spamming the user.
 * A missing class will be resolved in the resulting map with a "_missing" suffix.
 *
 * @param module     Path of the vanilla module.
 * @param classNames Classes to ensure are in the module, ensuring compilation and runtime
 *                   type-safety.
 */
export function getClassesModule<const TClassNames extends readonly string[]>(
  module: string,
  classNames: TClassNames
): { [Class in TClassNames[number]]: string } {
  let classes: Record<string, string>;

  try {
    classes = getModule(module, 'classes');
  } catch {
    classes = {};

    if (!ignoreResolveErrorsFor.has(module)) {
      logError(new Error(`Could not find module "${module}".`));

      ignoreResolveErrorsFor.add(module);
    }
  }

  for (const className of classNames) {
    if (!(className in classes)) {
      classes[className] = `${className}_missing`;

      if (!ignoreResolveErrorsFor.has(module + className)) {
        logError(new Error(`Could not find class "${className}" in module "${module}".`));

        ignoreResolveErrorsFor.add(module + className);
      }
    }
  }

  return classes as ReturnType<typeof getClassesModule<TClassNames>>;
}

/**
 * Resolve a Vanilla module export, ensuring the export exists and is of the correct type.
 * A missing module or export will show an error in the UI the first time it fails to resolve, then
 * it will be ignored to avoid spamming the user.
 * A missing export will resolve to the provided fallback value.
 *
 * @param module     Path of the vanilla module.
 * @param exportName Symbol export name.
 * @param guard      Type guard to ensure the export is of the correct type.
 * @param fallback   Fallback value to use if the export is missing or invalid.
 */
export function getModuleExport<TExport>(
  module: string,
  exportName: string,
  guard: (value: unknown) => value is TExport,
  fallback: TExport
): TExport {
  try {
    const exported = getModule(module, exportName);

    if (guard(exported)) {
      return exported;
    }

    if (!ignoreResolveErrorsFor.has(module)) {
      logError(new Error(`Export "${exportName}" in module "${module}" did not pass type guard.`));

      ignoreResolveErrorsFor.add(module);
    }

    return fallback;
  } catch {
    if (!ignoreResolveErrorsFor.has(module)) {
      logError(new Error(`Could not find export "${exportName}" in module "${module}".`));

      ignoreResolveErrorsFor.add(module);
    }

    return fallback;
  }
}

/**
 * Transforms a space-separated list of class names into a query selector, i.e.
 * "class1 class2 class3" -> ".class1.class2.class3".
 */
export function selector(classNames: string): string {
  // biome-ignore lint/style/useTemplate: intent clearer like that
  return `.` + classNames.replaceAll(' ', '.');
}
