import {
  type MouseEventHandler,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

export interface DraggableProps {
  readonly onMouseDown: MouseEventHandler;
}

/**
 * Provides a draggable behavior for an element.
 *
 * @param targetRef Reference to the element that should be moved when this element is dragged.
 *
 * @returns Props that should be passed to the handle element to make the target draggable.
 */
export function useDraggable(targetRef: RefObject<HTMLElement | null>): DraggableProps {
  const [isDragging, setIsDragging] = useState(false);

  // Maintains the state of the draggable element.
  const draggableState = useRef({
    element: null as HTMLElement | null,
    x: 0,
    y: 0
  });

  // Start dragging the element when the user mouses down on the element.
  const onMouseDown = useCallback(
    (event: ReactMouseEvent) => {
      // Do not start dragging if the user clicked on a button.
      let maybeButton: EventTarget | null = event.target;
      while (maybeButton) {
        if (maybeButton instanceof HTMLButtonElement) {
          return;
        }

        maybeButton = maybeButton instanceof HTMLElement ? maybeButton.parentElement : null;
      }

      const element = targetRef.current;
      if (!element) {
        return;
      }

      const { current: state } = draggableState;

      // If the element changed, reset the offset to 0, 0.
      if (state.element != element) {
        state.x = state.y = 0;
      }

      state.element = element;

      setIsDragging(true);
    },
    [targetRef]
  );

  // Move the element when the user moves the mouse, just applying delta.
  const onMouseMove = useCallback((event: MouseEvent) => {
    const { current: state } = draggableState;
    if (!state.element) {
      return;
    }

    state.x += event.movementX;
    state.y += event.movementY;

    // translate() would be more appropriate in theory, in a normal browser, but here at low FPS I
    // found left/top to work better.
    state.element.style.left = `${state.x}px`;
    state.element.style.top = `${state.y}px`;
  }, []);

  // Stop dragging when the user releases the mouse.
  const onMouseUp = useCallback(() => setIsDragging(false), []);

  // Add/remove event listeners when dragging.
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    } else {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, onMouseMove, onMouseUp]);

  return { onMouseDown };
}
