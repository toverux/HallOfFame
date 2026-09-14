import type { PanelProps } from 'cs2/ui';
import { type ComponentType, createElement } from 'react';
import { getModuleExport } from '../../../../utils';

/**
 * The panel the game builds its own windows on.
 *
 * The `Panel` of `cs2/ui` wraps this one and puts the whole header in a title bar; this one renders
 * the header as given, so a window can stack a title bar and a tab bar in it.
 */
export const Panel = getModuleExport<ComponentType<PanelProps>>(
  'game-ui/common/panel/panel.tsx',
  'Panel',
  // A `forwardRef` component is an object rather than a function.
  (value): value is ComponentType<PanelProps> =>
    value != null && (typeof value == 'function' || typeof value == 'object'),
  // Unstyled: only reached when the vanilla module is gone and already reported.
  ({ className, header, children }) => createElement('div', { className }, header, children)
);
