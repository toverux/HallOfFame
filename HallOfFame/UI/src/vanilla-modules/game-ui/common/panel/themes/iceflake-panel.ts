import type { PanelTheme } from 'cs2/ui';
import { getModuleExport } from '../../../../../utils';

/**
 * The panel theme of the game's large windows, the progression and transportation overview ones
 * among them: a dark title band with a bold title, over a gradient body.
 */
export const iceflakePanelTheme = getModuleExport<Partial<PanelTheme>>(
  'game-ui/common/panel/themes/iceflake-panel.module.scss',
  'classes',
  (value): value is Partial<PanelTheme> =>
    value != null && typeof value == 'object' && 'header' in value,
  // The panel's default theme: only reached when the vanilla module is gone and already reported.
  {}
);
