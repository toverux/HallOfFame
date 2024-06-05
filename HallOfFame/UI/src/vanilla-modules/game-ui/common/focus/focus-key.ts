import type { FOCUS_DISABLED as FOCUS_DISABLED_SYMBOL, FocusKey } from 'cs2/ui';
import { getModuleExport } from '../../../../utils';

export const FOCUS_DISABLED = getModuleExport<FocusKey>(
    'game-ui/common/focus/focus-key.ts',
    'FOCUS_DISABLED',
    (value): value is typeof FOCUS_DISABLED_SYMBOL => typeof value == 'symbol',
    'FOCUS_DISABLED'
);
