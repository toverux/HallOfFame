import type { FC, ReactNode } from 'react';
import { getModuleExport } from '../../../../../utils';

export interface TooltipLayoutProps {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly content?: ReactNode;
}

/**
 * The title-and-description body of a vanilla tooltip, as tooltip content.
 *
 * The game pairs it with a `Tooltip` in a `DescriptionTooltip`, which is the shape to reach for
 * where the tooltip's side does not matter; the mod's own `Tooltip` takes the body on its own.
 */
export const TooltipLayout = getModuleExport<FC<TooltipLayoutProps>>(
  'game-ui/common/tooltip/description-tooltip/description-tooltip.tsx',
  'TooltipLayout',
  (value): value is FC<TooltipLayoutProps> => typeof value == 'function',
  // No-op fallback: only reached when the vanilla module is gone and already reported.
  () => null
);
