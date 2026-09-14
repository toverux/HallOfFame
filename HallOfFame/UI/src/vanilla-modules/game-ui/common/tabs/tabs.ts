import { createElement, type FC, type ReactElement, type ReactNode } from 'react';
import { getModuleExport } from '../../../../utils';

export interface TabBarProps {
  readonly className?: string;
  readonly children?: ReactNode;
}

export interface TabProps<T> {
  readonly id: T;

  /**
   * The id of the selected tab: the tab shows as selected when it is its own.
   */
  readonly selectedId: T;

  readonly disabled?: boolean;

  /**
   * Adds a lock badge, for a tab behind something the player has not unlocked yet.
   */
  readonly locked?: boolean;

  readonly className?: string;
  readonly children?: ReactNode;
  readonly onSelect: (id: T) => void;
}

type TabComponent = <T>(props: TabProps<T>) => ReactElement | null;

/**
 * The row of tabs a panel carries under its title, centred.
 */
export const TabBar = getModuleExport<FC<TabBarProps>>(
  'game-ui/common/tabs/tabs.tsx',
  'TabBar',
  (value): value is FC<TabBarProps> => typeof value == 'function',
  // Unstyled: only reached when the vanilla module is gone and already reported.
  ({ className, children }) => createElement('div', { className }, children)
);

/**
 * One tab of a {@link TabBar}.
 */
export const Tab = getModuleExport<TabComponent>(
  'game-ui/common/tabs/tabs.tsx',
  'Tab',
  (value): value is TabComponent => typeof value == 'function',
  // Unstyled and inert, as above.
  ({ className, children }) => createElement('div', { className }, children)
);
