import { bindValue, type ValueBinding } from 'cs2/api';

/**
 * Lazily creates a {@link ValueBinding} on first use instead of at module load.
 *
 * The eager `bindValue(...)` form instantiates an engine binding as soon as a bindings module, or
 * any component importing it, is loaded. This wrapper defers creation to the first call of the
 * returned accessor (the first render that reads the binding) and memoizes the instance, so its
 * identity stays stable across renders and subscriptions are shared.
 */
export function lazyBindValue<T>(
  group: string,
  name: string,
  fallbackValue?: T
): () => ValueBinding<T> {
  let binding: ValueBinding<T> | undefined;

  return () => {
    binding ??= bindValue<T>(group, name, fallbackValue);

    return binding;
  };
}
