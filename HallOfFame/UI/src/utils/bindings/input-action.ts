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
   * Calls `onPhase` on each phase change of the action from now on, every change of an update
   * included, where `useInputPhase` renders only the last one.
   * A change made before the call is not reported.
   */
  readonly useInputPhaseChange: (onPhase: (phase: InputActionPhase) => void) => void;

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
 * @see useInputPhaseChange
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
  return {
    id: `${group}.${name}`,
    useInputBinding,
    useInputPhase,
    useInputPhaseChange,
    useInputPress
  };

  function useInputBinding(): ProxyBinding {
    return useValue(binding$());
  }

  function useInputPhase(): InputActionPhase {
    return useValue(phase$());
  }

  function useInputPhaseChange(onPhase: (phase: InputActionPhase) => void): void {
    // The latest callback, read by one listener: a new listener would subscribe anew, which toggles
    // the action in the game.
    const onPhaseRef = useRef(onPhase);

    useLayoutEffect(() => {
      onPhaseRef.current = onPhase;
    });

    const listener = useCallback((phase: InputActionPhase) => onPhaseRef.current(phase), []);

    useValueOnChange(phase$(), listener);
  }

  function useInputPress(onPress: () => void): void {
    useInputPhaseChange(phase => {
      if (phase == 'Performed') {
        onPress();
      }
    });
  }
}
