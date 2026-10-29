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

  it(`lists its step's keys with what they do`, () => {
    setBinding('hallOfFame.menuTour', 'step', 'navigation');

    renderAnchor();

    expect(screen.getByText('HallOfFame.UI.Menu.MenuTour.INPUT_HINT[Navigation]')).toBeDefined();
  });

  it(`moves the tour on when the player presses its control`, () => {
    setBinding('hallOfFame.menuTour', 'step', 'navigation');

    renderAnchor();

    fireEvent.mouseDown(screen.getByTestId('control'));

    expect(getTriggers().map(trigger => trigger.event)).toEqual(['hallOfFame.menuTour.next']);
  });

  it(`moves the tour on when the player presses one of its step's keys`, () => {
    setBinding('hallOfFame.menuTour', 'step', 'navigation');

    renderAnchor();

    act(() =>
      setBinding('hallOfFame.slideshow', 'previousScreenshotInputAction.phase', 'Performed')
    );

    expect(getTriggers().map(trigger => trigger.event)).toEqual(['hallOfFame.menuTour.next']);
  });

  it(`leaves the tour alone when its control or keys are used on another step`, () => {
    setBinding('hallOfFame.menuTour', 'step', 'like');

    renderAnchor();

    fireEvent.mouseDown(screen.getByTestId('control'));

    act(() => setBinding('hallOfFame.slideshow', 'nextScreenshotInputAction.phase', 'Performed'));

    expect(getTriggers()).toEqual([]);
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
      <span data-testid='control' />
    </MenuTourAnchor>
  );
}

// `translate()` returns the id when no fallback is given, so a button's label is its id.
const nextLabel = 'HallOfFame.UI.Menu.MenuTour.ACTION[Next]';

const closeLabel = 'HallOfFame.UI.Menu.MenuTour.ACTION[Close]';
