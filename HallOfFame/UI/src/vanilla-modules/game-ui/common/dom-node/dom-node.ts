import {
  type Context,
  createContext,
  type CSSProperties,
  forwardRef,
  type ForwardRefExoticComponent,
  type ReactElement,
  type RefAttributes
} from 'react';
import { getModuleExport, isRenderable } from '../../../../utils';

/**
 * Inferred from `game-ui/common/dom-node/dom-node.tsx`.
 */
export interface DOMNodeContextValue {
  readonly ref: (element: HTMLElement | null) => void;
  readonly style?: CSSProperties;
  readonly className?: string;
}

/**
 * The context a component claims to hand a {@link DOMNodeModifier} its root DOM element.
 */
export const DOMNodeContext = getModuleExport<Context<DOMNodeContextValue | undefined>>(
  'game-ui/common/dom-node/dom-node.tsx',
  'DOMNodeContext',
  (value): value is Context<DOMNodeContextValue | undefined> =>
    value != null && typeof value == 'object' && 'Provider' in value,
  createContext<DOMNodeContextValue | undefined>(undefined)
);

/**
 * How a vanilla component hands a parent the handle on its root DOM element: the wrapper publishes
 * it, so that a parent gets the child subtree's root element without a ref the child would have to
 * forward.
 *
 * A host element as its child is served automatically. A component has to claim the game's
 * {@link DOMNodeContext} itself and apply its `ref`, class and style to the element it renders: one
 * that ignores it leaves the parent measuring nothing, which is how an anchored popup ends up
 * positionless and hidden.
 */
export const DOMNodeModifier = getModuleExport<DOMNodeModifierComponent>(
  'game-ui/common/dom-node/dom-node.tsx',
  'DOMNodeModifier',
  (value): value is DOMNodeModifierComponent => isRenderable(value),
  // The fallback drops the ref, since with the vanilla module gone there is no handle to hand back.
  forwardRef(({ children }: DOMNodeModifierProps, _ref) => children)
);

interface DOMNodeModifierProps {
  readonly children: ReactElement;
}

type DOMNodeModifierComponent = ForwardRefExoticComponent<
  DOMNodeModifierProps & RefAttributes<HTMLElement>
>;
