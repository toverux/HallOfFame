import { useValue, useValueOnChange } from 'cs2/api';
import type { ControlPath } from 'cs2/input';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { lazyBindValue } from './lazy-value-binding';

export interface ProxyBinding {
  readonly binding: ControlPath;
  // Mutable, as the game's `ControlIcons` takes it.
  readonly modifiers: ControlPath[];
}

export interface InputAction {
  /**
   * The action's binding, as `group.name`.
   */
  readonly id: string;

  readonly useInputBinding: () => ProxyBinding;
  readonly useInputPhase: () => InputActionPhase;

  /**
   * Calls `onPress` on each press of the action from now on, a press released in the frame it came
   * in included, which `useInputPhase` misses: it renders only the release.
   * A press made before the call is not reported.
   */
  readonly useInputPress: (onPress: () => void) => void;
}

export type InputActionPhase = 'Disabled' | 'Waiting' | 'Started' | 'Performed' | 'Canceled';

/**
 * Gives a set of hooks to work with an input binding and action.
 * Binds to a `HallOfFame.Utils.InputActionBinding` binding in the C# side.
 *
 * @see useInputBinding
 * @see useInputPhase
 * @see useInputPress
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
  return { id: `${group}.${name}`, useInputBinding, useInputPhase, useInputPress };

  function useInputBinding(): ProxyBinding {
    return useValue(binding$());
  }

  function useInputPhase(): InputActionPhase {
    return useValue(phase$());
  }

  function useInputPress(onPress: () => void): void {
    // The latest callback, read by one listener: a new listener would subscribe anew, which toggles
    // the action in the game.
    const onPressRef = useRef(onPress);

    useLayoutEffect(() => {
      onPressRef.current = onPress;
    });

    const onPhase = useCallback((phase: InputActionPhase) => {
      if (phase == 'Performed') {
        onPressRef.current();
      }
    }, []);

    useValueOnChange(phase$(), onPhase);
  }
}
