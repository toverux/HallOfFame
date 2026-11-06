import { getTriggers } from './game-setup';

/**
 * Returns the usage events `trackUsage` fired since the last `resetBindings` call, each as its name
 * and properties.
 */
export function getUsageEvents(): ReadonlyArray<readonly unknown[]> {
  return getTriggers()
    .filter(({ event }) => event == 'hallOfFame.usage.trackUsage')
    .map(({ args }) => args);
}
