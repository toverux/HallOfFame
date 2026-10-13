import { afterEach, describe, expect, it } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import { Scrollable } from 'cs2/ui';
import type { ReactElement } from 'react';
import { resetBindings } from '../testing/game-setup';
import { useUniformVirtualList } from './virtual-list';

afterEach(() => {
  cleanup();
  resetBindings();
});

describe('useUniformVirtualList', () => {
  // The container reads a zero height on every frame, happy-dom laying nothing out, as a freshly
  // mounted one does in cohtml until the engine reaches it.
  it(`renders more than one row while its container is not laid out yet`, async () => {
    render(<List />);

    // The list reads its viewport on each of the two frames after it mounts.
    await act(async () => {
      await nextFrame();
      await nextFrame();
    });

    expect(document.querySelectorAll('[data-row]').length).toBeGreaterThan(1);
  });
});

function List(): ReactElement {
  const { anchorRef, list } = useUniformVirtualList({
    count: 100,
    overscan: 1,
    rowSelector: '[data-row]',
    estimatedRowHeightPx: 100,
    renderRow: index => <div key={index} data-row={true} />
  });

  return (
    <Scrollable>
      <div ref={anchorRef} />
      {list}
    </Scrollable>
  );
}

function nextFrame(): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new - requestAnimationFrame only takes a callback
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}
