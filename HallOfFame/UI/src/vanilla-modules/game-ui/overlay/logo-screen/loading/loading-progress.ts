import type { FC } from 'react';
import { getClassesModule, getModuleExport } from '../../../../../utils';

const coLoadingStyles = getClassesModule(
  'game-ui/overlay/logo-screen/loading/loading.module.scss',
  ['progress']
);

interface LoadingProgressProps {
  size: number;
  lineWidth: number;
  progress: [number, number, number];
  progressColors: [string, string, string];
  className?: string;
}

/**
 * Those are values used by vanilla for the loading screens.
 * @public
 */
export const loadingProgressVanillaProps = {
  size: 128,
  lineWidth: 8,
  progressColors: ['#E1F8FF', '#84E2FF', '#12C8FF'],
  className: coLoadingStyles.progress
} satisfies Partial<LoadingProgressProps>;

/**
 * Loading circles that are displayed on the loading screens.
 * @public
 */
export const LoadingProgress = getModuleExport<FC<LoadingProgressProps>>(
  'game-ui/overlay/logo-screen/loading/loading-progress.tsx',
  'LoadingProgress',
  (value): value is FC<LoadingProgressProps> => typeof value == 'function',
  () => null
);
