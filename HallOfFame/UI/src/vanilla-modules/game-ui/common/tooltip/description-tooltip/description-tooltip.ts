import type { TooltipProps } from 'cs2/ui';
import type { FC, ReactNode } from 'react';
import { getModuleExport } from '../../../../../utils';

interface DescriptionTooltipProps extends Omit<TooltipProps, 'tooltip'> {
    readonly title: string | null;
    readonly description: string | null;
    readonly content?: ReactNode;
}

export const DescriptionTooltip = getModuleExport<FC<DescriptionTooltipProps>>(
    'game-ui/common/tooltip/description-tooltip/description-tooltip.tsx',
    'DescriptionTooltip',
    (value): value is FC<DescriptionTooltipProps> => typeof value == 'function',
    props => props.children
);
