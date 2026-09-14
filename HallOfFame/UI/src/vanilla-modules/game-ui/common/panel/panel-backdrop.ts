import { createElement, type FC, Fragment, type ReactNode } from 'react';
import { getModuleExport } from '../../../../utils';

export interface PanelBackdropProps {
  readonly className?: string;

  /**
   * Stacks the backdrop, and the panel in it, above other backdrops.
   */
  readonly zIndex?: number;

  /**
   * Called on a press on the backdrop itself, outside the panel it holds.
   */
  readonly onMouseDown?: () => void;

  readonly children?: ReactNode;
}

/**
 * The dimmed and blurred layer the game lays under a modal panel, centring the panel on screen.
 */
export const PanelBackdrop = getModuleExport<FC<PanelBackdropProps>>(
  'game-ui/common/panel/panel-backdrop.tsx',
  'PanelBackdrop',
  (value): value is FC<PanelBackdropProps> => typeof value == 'function',
  // The panel alone: only reached when the vanilla module is gone and already reported.
  ({ children }) => createElement(Fragment, null, children)
);
