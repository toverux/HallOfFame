import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTriggers, resetBindings } from '../../testing/game-setup';
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

    await user.click(screen.getByText('HallOfFame.UI.Menu.MenuControls.ACTION[Creator Dashboard]'));

    expect(getTriggers().map(trigger => trigger.event)).toContain('hallOfFame.dashboard.open');
  });
});
