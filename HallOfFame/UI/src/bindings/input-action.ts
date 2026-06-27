import { useValue } from 'cs2/api';
import type { ControlPath } from 'cs2/input';
import { lazyBindValue } from './lazy-value-binding';

export interface ProxyBinding {
  readonly binding: ControlPath;
  readonly modifiers: ControlPath[];
}

export type InputActionPhase = 'Disabled' | 'Waiting' | 'Started' | 'Performed' | 'Canceled';

/**
 * Gives a set of hooks to work with an input binding and action.
 * Binds to a `HallOfFame.Utils.InputActionBinding` binding in the C# side.
 *
 * @see useInputBinding
 * @see useInputPhase
 */
export function bindInputAction(
  group: string,
  name: string
): {
  useInputBinding: () => ProxyBinding;
  useInputPhase: () => InputActionPhase;
} {
  const binding$ = lazyBindValue<ProxyBinding>(group, `${name}.binding`, {
    binding: {
      device: 'Unknown',
      displayName: 'Unknown',
      name: 'Unknown'
    },
    modifiers: []
  });

  const phase$ = lazyBindValue<InputActionPhase>(group, `${name}.phase`, 'Disabled');

  // noinspection JSUnusedGlobalSymbols
  return { useInputBinding, useInputPhase };

  function useInputBinding(): ProxyBinding {
    return useValue(binding$());
  }

  function useInputPhase(): InputActionPhase {
    return useValue(phase$());
  }
}
