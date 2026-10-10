import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Tooltip } from './tooltip';

afterEach(() => {
  cleanup();

  // A notch holds every tooltip until the mouse moves, a test's included.
  fireEvent.mouseMove(document.body);
});

const TIP_A = 'TIP-A';
const TIP_B = 'TIP-B';
const ANCHOR_A = 'ANCHOR-A';
const ANCHOR_B = 'ANCHOR-B';

// Two tooltips over neighbouring anchors, as two rows of a scrolling list.
function TwoTooltips(): ReactElement {
  return (
    <>
      <Tooltip tooltip={<span>{TIP_A}</span>} delayTime={0}>
        <div>{ANCHOR_A}</div>
      </Tooltip>

      <Tooltip tooltip={<span>{TIP_B}</span>} delayTime={0}>
        <div>{ANCHOR_B}</div>
      </Tooltip>
    </>
  );
}

function anchor(name: string): HTMLElement {
  return screen.getByText(name);
}

function isShown(tip: string): boolean {
  return screen.queryByText(tip) != null;
}

// The balloon leaves through its exit transition.
function expectHidden(tip: string): Promise<void> {
  return waitFor(() => {
    expect(isShown(tip)).toBe(false);
  });
}

describe('Tooltip', () => {
  it(`opens on hover and closes on a wheel notch`, async () => {
    render(<TwoTooltips />);

    fireEvent.mouseOver(anchor(ANCHOR_A));

    expect(isShown(TIP_A)).toBe(true);

    fireEvent.wheel(anchor(ANCHOR_A));

    await expectHidden(TIP_A);
  });

  it(`holds every tooltip closed after a notch until the mouse moves, the scrolled-under one too`, async () => {
    render(<TwoTooltips />);

    fireEvent.mouseOver(anchor(ANCHOR_A));

    expect(isShown(TIP_A)).toBe(true);

    fireEvent.wheel(anchor(ANCHOR_A));

    // The engine re-runs its hit test after the scroll and fires mouseover on the row now under the
    // still cursor, with no mousemove.
    fireEvent.mouseOver(anchor(ANCHOR_B));

    await expectHidden(TIP_A);
    expect(isShown(TIP_B)).toBe(false);

    fireEvent.mouseMove(anchor(ANCHOR_B));

    expect(isShown(TIP_B)).toBe(true);
  });

  it(`stays closed after a press, through a wheel hold and the move releasing it`, async () => {
    render(<TwoTooltips />);

    fireEvent.mouseOver(anchor(ANCHOR_A));
    fireEvent.wheel(anchor(ANCHOR_A));
    fireEvent.mouseDown(anchor(ANCHOR_A));
    fireEvent.mouseMove(anchor(ANCHOR_A));

    await expectHidden(TIP_A);

    fireEvent.mouseOver(anchor(ANCHOR_A));

    expect(isShown(TIP_A)).toBe(true);

    fireEvent.mouseDown(anchor(ANCHOR_A));
    fireEvent.wheel(anchor(ANCHOR_A));
    fireEvent.mouseMove(anchor(ANCHOR_A));

    await expectHidden(TIP_A);
  });
});
