import { trigger } from 'cs2/api';
import { getModule } from 'cs2/modding';

/** @see getClassesModule */
const ignoreResolveErrorsFor = new Set<string>();

/**
 * Resolve a Vanilla scoped class name (ex. "vanilla-name_k91") from an exposed
 * scss module, ensuring the desired class(es) are indeed in that module,
 * ensuring type safety and correct error handling.
 * A missing module or class will show an error in the UI the first time it
 * fails to resolve, then it will be ignored to avoid spamming the user.
 * A missing class will resolve in the resulting map with a "_missing" suffix.
 *
 * @param module     Path of the vanilla module.
 * @param classNames Classes to ensure are in the module, ensuring compilation
 *                   and runtime type safety.
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
                logError(
                    new Error(
                        `Could not find class "${className}" in module "${module}".`
                    )
                );

                ignoreResolveErrorsFor.add(module + className);
            }
        }
    }

    return classes as ReturnType<typeof getClassesModule<TClassNames>>;
}

/**
 * Shows an error dialog and logs the error in the mod's logs instead of just in
 * UI log.
 */
export function logError(error: unknown, fatal = false): void {
    console.error(error);

    const errorString = error instanceof Error ? error.stack : String(error);

    trigger('hallOfFame', 'logJavaScriptError', fatal, errorString);
}
