import type { PanelTitleBarTheme } from 'cs2/ui';
import { createElement, type FC, type ReactNode } from 'react';
import { getModuleExport } from '../../../../utils';

export interface PanelTitleBarProps {
  readonly icon?: string;
  readonly theme?: Partial<PanelTitleBarTheme>;
  readonly className?: string;
  readonly children?: ReactNode;

  /**
   * Replaces the close handler the title bar otherwise reads from the panel around it.
   */
  readonly onCloseOverride?: () => void;
}

/**
 * A panel's title, with a close button when the panel has a close handler and the player is on
 * keyboard and mouse.
 */
export const PanelTitleBar = getModuleExport<FC<PanelTitleBarProps>>(
  'game-ui/common/panel/panel-title-bar.tsx',
  'PanelTitleBar',
  (value): value is FC<PanelTitleBarProps> => typeof value == 'function',
  // The title alone: only reached when the vanilla module is gone and already reported.
  ({ className, children }) => createElement('div', { className }, children)
);
