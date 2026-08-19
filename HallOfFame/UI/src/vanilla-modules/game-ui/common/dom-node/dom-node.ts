import {
  type Context,
  createContext,
  type CSSProperties,
  forwardRef,
  type ForwardRefExoticComponent,
  type ReactElement,
  type RefAttributes
} from 'react';
import { getModuleExport } from '../../../../utils';

/**
 * Inferred from `game-ui/common/dom-node/dom-node.tsx`.
 */
export interface DOMNodeContextValue {
  readonly ref: (element: HTMLElement | null) => void;
  readonly style?: CSSProperties;
  readonly className?: string;
}

/**
 * How a vanilla component hands a parent the handle on its root DOM element.
 *
 * The parent renders a `DOMNode` around the subtree and publishes this context; the leaf that
 * actually renders an element is expected to apply the `ref` (and the class and style) to it.
 * Vanilla leaves do that for themselves, so a mod component standing in for one has to as well: a
 * leaf that ignores the context leaves the parent measuring nothing, which is how an anchored popup
 * ends up positionless and hidden.
 */
export const DOMNodeContext = getModuleExport<Context<DOMNodeContextValue | undefined>>(
  'game-ui/common/dom-node/dom-node.tsx',
  'DOMNodeContext',
  (value): value is Context<DOMNodeContextValue | undefined> =>
    value != null && typeof value == 'object' && 'Provider' in value,
  createContext<DOMNodeContextValue | undefined>(undefined)
);

/**
 * The other side of {@link DOMNodeContext}: the wrapper that publishes the handle, so that a parent
 * gets the child subtree's root element without needing a ref the child would have to forward.
 *
 * A host element as its child is served automatically; a component has to claim the context itself.
 */
export const DOMNodeModifier = getModuleExport<DOMNodeModifierComponent>(
  'game-ui/common/dom-node/dom-node.tsx',
  'DOMNodeModifier',
  // A memoized component is an object, not a function, so the guard can only check that this is
  // something React could render.
  (value): value is DOMNodeModifierComponent =>
    typeof value == 'function' || (value != null && typeof value == 'object'),
  // The fallback drops the ref, since with the vanilla module gone there is no handle to hand back.
  forwardRef(({ children }: DOMNodeModifierProps, _ref) => children)
);

interface DOMNodeModifierProps {
  readonly children: ReactElement;
}

type DOMNodeModifierComponent = ForwardRefExoticComponent<
  DOMNodeModifierProps & RefAttributes<HTMLElement>
>;
