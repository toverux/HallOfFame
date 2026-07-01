import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
/**
 * A function to make a shareable useState-like hook that shares its value and updates with all
 * components using the same instance.
 *
 *
 * @link https://stackoverflow.com/questions/57602715/react-custom-hooks-fetch-data-globally-and-share-across-components/61449641#61449641
 *
 * @example
 * const useSingletonState = createSingletonHook(0);
 *
 * function MyComponent() {
 *     const [value, setValue] = useSingletonState();
 * }
 */

export function createSingletonHook<T>(initialValue: T) {
  let sharedValue: T = initialValue;

  const listeners = new Set<(value: T) => void>();

  function notifyListeners(): void {
    for (const listener of listeners) {
      listener(sharedValue);
    }
  }

  // Defined once, outside the hook, so it keeps a stable identity across renders and is shared by
  // every component using this singleton. A stable setter lets consumers safely omit it from
  // dependency arrays and memoize the handlers that update the value. It also accepts a functional
  // update (prev => next) like React's useState, so consumers do not need to close over the current
  // value to compute the next one, which keeps those handlers stable too.
  function setSharedValue(action: SetStateAction<T>): void {
    sharedValue = typeof action == 'function' ? (action as (prev: T) => T)(sharedValue) : action;

    notifyListeners();
  }

  return function useSingleton(): readonly [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(sharedValue);

    useEffect(() => {
      const listener = (newValue: T) => setValue(newValue);

      listeners.add(listener);

      return () => void listeners.delete(listener);
    }, []);

    return [value, setSharedValue] as const;
  };
}
