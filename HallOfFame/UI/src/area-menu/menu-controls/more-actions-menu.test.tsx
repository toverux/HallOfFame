import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTriggers, getUsageEvents, resetBindings } from '../../testing/game-setup';
import { MenuControlsMoreActionsMenu } from './more-actions-menu';

afterEach(() => {
  cleanup();
  resetBindings();
});

describe('MenuControlsMoreActionsMenu', () => {
  it(`opens the Creator Dashboard from its item`, async () => {
    const user = userEvent.setup();

    render(<MenuControlsMoreActionsMenu isSaving={false} saveDirectory='' />);

    // The round toggle is the menu's only button while the popup is closed.
    await user.click(screen.getByRole('button'));

    const item = 'HallOfFame.UI.Menu.MenuControls.ACTION[Creator Dashboard]';

    await user.click(screen.getByText(item));

    expect(getTriggers().map(trigger => trigger.event)).toContain('hallOfFame.dashboard.open');

    // The popup's exit runs on timers, which would otherwise fire inside the next test.
    await waitFor(() => expect(screen.queryByText(item)).toBeNull());
  });

  it(`reports each opening of the menu, for the menu tour and as a usage event`, async () => {
    const user = userEvent.setup();

    render(<MenuControlsMoreActionsMenu isSaving={false} saveDirectory='' />);

    const toggle = screen.getByRole('button');

    await user.click(toggle);

    expect(getTriggers().map(trigger => trigger.event)).toContain(
      'hallOfFame.menuTour.moreActionsOpened'
    );
    expect(getUsageEvents()).toEqual([['more_actions_opened', {}]]);

    // Closed again, so the popup's exit timers fire here rather than inside the next test.
    await user.click(toggle);

    await waitFor(() =>
      expect(
        screen.queryByText('HallOfFame.UI.Menu.MenuControls.ACTION[Creator Dashboard]')
      ).toBeNull()
    );
  });
});
