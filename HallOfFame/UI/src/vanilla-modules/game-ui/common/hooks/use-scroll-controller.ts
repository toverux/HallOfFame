import type { ScrollController } from 'cs2/ui';
import { getModuleExport } from '../../../../utils';

/** @public */
export const useScrollController = getModuleExport<(() => ScrollController) | undefined>(
  'game-ui/common/hooks/use-scroll-controller.tsx',
  'useScrollController',
  (value): value is () => ScrollController => typeof value == 'function',
  undefined
);
