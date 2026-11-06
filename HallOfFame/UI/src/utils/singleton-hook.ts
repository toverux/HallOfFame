import { type Dispatch, type SetStateAction, useSyncExternalStore } from 'react';

/**
 * A function to make a shareable useState-like hook that shares its value and updates with all
 * components using the same instance.
 *
 * @example
 *   const useSingletonState = createSingletonHook(0);
 *
 *   function MyComponent() {
 *     const [value, setValue] = useSingletonState();
 *   }
 */
export function createSingletonHook<T>(
  initialValue: T
): () => readonly [T, Dispatch<SetStateAction<T>>] {
  let sharedValue: T = initialValue;

  const listeners = new Set<() => void>();

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => void listeners.delete(listener);
  }

  function getSnapshot(): T {
    return sharedValue;
  }

  function notifyListeners(): void {
    for (const listener of listeners) {
      listener();
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

  // React reads the store again once subscribed, so a component mounting in the same commit as an
  // update still gets it.
  return function useSingleton(): readonly [T, Dispatch<SetStateAction<T>>] {
    return [useSyncExternalStore(subscribe, getSnapshot), setSharedValue] as const;
  };
}
