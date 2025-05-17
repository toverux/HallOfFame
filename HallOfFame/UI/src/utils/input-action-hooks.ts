import { bindValue, trigger, useValue } from 'cs2/api';
import type { ControlPath } from 'cs2/input';
import type { UISound } from 'cs2/ui';
import { useEffect } from 'react';

export interface ProxyBinding {
  readonly binding: ControlPath;
  readonly modifiers: ControlPath[];
}

type InputActionPhase = 'Disabled' | 'Waiting' | 'Started' | 'Performed' | 'Canceled';

/**
 * Gives a set of hooks to work with an input binding and action.
 * Bind to a `HallOfFame.Utils.InputActionBinding` binding in the C# side.
 *
 * @see useInputBinding
 * @see useInputPhase
 * @see useOnInputPerformed
 */
export function bindInputAction(group: string, name: string) {
  const binding$ = bindValue<ProxyBinding>(group, `${name}.binding`, {
    binding: {
      device: 'Unknown',
      displayName: 'Unknown',
      name: 'Unknown'
    },
    modifiers: []
  });

  const phase$ = bindValue<InputActionPhase>(group, `${name}.phase`, 'Disabled');

  // noinspection JSUnusedGlobalSymbols
  return { useInputBinding, useInputPhase, useOnInputPerformed };

  function useInputBinding(): ProxyBinding {
    return useValue(binding$);
  }

  function useInputPhase(): InputActionPhase {
    return useValue(phase$);
  }

  /**
   * Triggers the {@link handler} when the input action is performed (key pressed, not key
   * released).
   *
   * @param handler The function to call when the input action is performed.
   *                It can return a boolean to indicate if the sound should be played or not.
   *                If it returns `undefined`, the sound will be played.
   * @param sound   The sound to play when the input action is performed.
   */
  function useOnInputPerformed(
    // biome-ignore lint/suspicious/noConfusingVoidType: it's really how I want it to be here.
    handler: () => boolean | undefined | void,
    sound?: `${UISound}`
  ) {
    const phase = useInputPhase();

    // biome-ignore lint/correctness/useExhaustiveDependencies: just want to trigger on phase changes
    useEffect(() => {
      if (phase == 'Performed') {
        const playSound = handler() ?? true;

        if (playSound && sound) {
          trigger('audio', 'playSound', sound, 1);
        }
      }
    }, [phase]);
  }
}
