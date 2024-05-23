import { trigger } from 'cs2/api';

/**
 * Shows an error dialog and logs the error in the mod's logs instead of just in
 * UI log.
 */
export function logError(error: unknown, fatal = false): void {
    console.error(error);

    const errorString = error instanceof Error ? error.stack : String(error);

    trigger('hallOfFame', 'logJavaScriptError', fatal, errorString);
}
