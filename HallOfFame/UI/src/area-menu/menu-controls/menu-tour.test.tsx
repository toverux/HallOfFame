import { afterEach, describe, expect, it } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { getTriggers, resetBindings, setBinding } from '../../testing/game-setup';
import { MenuTourAnchor } from './menu-tour';

afterEach(() => {
  cleanup();
  resetBindings();
});

describe('MenuTourAnchor', () => {
  it(`shows its step's balloon, which moves the tour on or closes it`, () => {
    setBinding('hallOfFame.menuTour', 'step', 'navigation');

    renderAnchor();

    expect(screen.getByText('HallOfFame.UI.Menu.MenuTour.TITLE[Navigation]')).toBeDefined();

    fireEvent.click(screen.getByText(nextLabel));
    fireEvent.click(screen.getByText(closeLabel));

    expect(getTriggers().map(trigger => trigger.event)).toEqual([
      'hallOfFame.menuTour.next',
      'hallOfFame.menuTour.close'
    ]);
  });

  it(`offers only Close on the last step`, () => {
    setBinding('hallOfFame.menuTour', 'step', 'navigation');
    setBinding('hallOfFame.menuTour', 'isLastStep', true);

    renderAnchor();

    expect(screen.getByText(closeLabel)).toBeDefined();
    expect(screen.queryByText(nextLabel)).toBeNull();
  });

  it(`shows nothing while the tour is on another step`, () => {
    setBinding('hallOfFame.menuTour', 'step', 'like');

    renderAnchor();

    expect(screen.queryByText(closeLabel)).toBeNull();
  });

  it(`shows its balloon once the tour moves onto its step`, () => {
    setBinding('hallOfFame.menuTour', 'step', 'like');

    renderAnchor();

    act(() => setBinding('hallOfFame.menuTour', 'step', 'navigation'));

    expect(screen.getByText(closeLabel)).toBeDefined();
  });

  it(`hides its balloon while the dashboard covers the controls`, () => {
    setBinding('hallOfFame.menuTour', 'step', 'navigation');
    setBinding('hallOfFame.dashboard', 'state', { status: 'loading' });

    renderAnchor();

    expect(screen.queryByText(closeLabel)).toBeNull();
  });
});

function renderAnchor(): void {
  render(
    <MenuTourAnchor step='navigation'>
      <span />
    </MenuTourAnchor>
  );
}

// `translate()` returns the id when no fallback is given, so a button's label is its id.
const nextLabel = 'HallOfFame.UI.Menu.MenuTour.ACTION[Next]';

const closeLabel = 'HallOfFame.UI.Menu.MenuTour.ACTION[Close]';
