import { useEffect, useState } from 'react';

/**
 * A function to make a shareable useState-like hook that shares its value and
 * updates with all components using the same instance.
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

    return function useSingleton() {
        const [value, setValue] = useState<T>(sharedValue);

        useEffect(() => {
            const listener = (newValue: T) => setValue(newValue);

            listeners.add(listener);

            return () => void listeners.delete(listener);
        }, []);

        function updateValue(newValue: T): void {
            sharedValue = newValue;
            notifyListeners();
        }

        return [value, updateValue] as const;
    };
}
