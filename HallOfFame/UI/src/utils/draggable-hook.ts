import {
  type MouseEventHandler,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';

/**
 * Provides a simple draggable behavior for an element (the whole element is
 * draggable, there is no handle to move another target element).
 *
 * @returns Props that should be passed to the element to make draggable.
 */
export function useDraggable(): { readonly onMouseDown: MouseEventHandler } {
  const [isDragging, setIsDragging] = useState(false);

  // Maintains the state of the draggable element.
  const draggableState = useRef({
    element: undefined as HTMLElement | undefined,
    x: 0,
    y: 0
  });

  // Start dragging the element when the user mouses down on the element.
  const onMouseDown = useCallback((event: ReactMouseEvent) => {
    // Do not start dragging if the user clicked on a button.
    let maybeButton: EventTarget | null = event.target;
    while (maybeButton) {
      if (maybeButton instanceof HTMLButtonElement) {
        return;
      }

      maybeButton = maybeButton instanceof HTMLElement ? maybeButton.parentElement : null;
    }

    const { current: state } = draggableState;

    // If the element changed, reset the offset to 0, 0.
    if (state.element != event.currentTarget) {
      state.x = state.y = 0;
    }

    state.element = event.currentTarget as HTMLElement;

    setIsDragging(true);
  }, []);

  // Move the element when the user moves the mouse, just applying delta.
  const onMouseMove = useCallback((event: MouseEvent) => {
    const { current: state } = draggableState;
    if (!state.element) {
      return;
    }

    state.x += event.movementX;
    state.y += event.movementY;

    // translate() would be more appropriate in theory, in a normal browser,
    // but here at low FPS I found left/top to work better.
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
