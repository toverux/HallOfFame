import { useValue } from 'cs2/api';
import type { ControlPath } from 'cs2/input';
import { lazyBindValue } from './lazy-value-binding';

export interface ProxyBinding {
  readonly binding: ControlPath;
  readonly modifiers: ControlPath[];
}

export interface InputAction {
  /**
   * The action's binding, as `group.name`.
   */
  readonly id: string;

  readonly useInputBinding: () => ProxyBinding;
  readonly useInputPhase: () => InputActionPhase;
}

export type InputActionPhase = 'Disabled' | 'Waiting' | 'Started' | 'Performed' | 'Canceled';

/**
 * Gives a set of hooks to work with an input binding and action.
 * Binds to a `HallOfFame.Utils.InputActionBinding` binding in the C# side.
 *
 * @see useInputBinding
 * @see useInputPhase
 */
export function bindInputAction(group: string, name: string): InputAction {
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
  return { id: `${group}.${name}`, useInputBinding, useInputPhase };

  function useInputBinding(): ProxyBinding {
    return useValue(binding$());
  }

  function useInputPhase(): InputActionPhase {
    return useValue(phase$());
  }
}
