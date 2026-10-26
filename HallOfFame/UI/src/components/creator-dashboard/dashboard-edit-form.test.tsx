import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeJsonMod, makeMod, makeScreenshot } from '../../testing/fixtures';
import { getTriggers, resetBindings, setBinding } from '../../testing/game-setup';
import { DashboardEditForm } from './dashboard-edit-form';

afterEach(() => {
  cleanup();
  resetBindings();
});

const updateEvent = 'hallOfFame.dashboard.update';

// `translate()` returns the id when no fallback is given, so a label is its id.
const saveLabel = 'HallOfFame.UI.Dashboard.EDIT_ACTION[Save]';

const screenshot = makeScreenshot({
  id: 'a',
  cityName: 'Old Town',
  description: 'A quiet harbour.',
  shareParadoxModIds: true,
  shareRenderSettings: false
});

function saveButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name: saveLabel });
}

function cityNameInput(): HTMLInputElement {
  return query('[data-dashboard-edit-form] input', HTMLInputElement);
}

function query<T extends Element>(selector: string, type: abstract new () => T): T {
  const element = document.querySelector(selector);

  if (!(element instanceof type)) {
    throw new TypeError(`No ${type.name} matches ${selector}.`);
  }

  return element;
}

describe('DashboardEditForm', () => {
  it(`opens on the screenshot's fields, with nothing to save`, () => {
    render(<DashboardEditForm screenshot={screenshot} isSaving={false} />);

    expect(cityNameInput().value).toBe('Old Town');
    expect(saveButton().disabled).toBe(true);
  });

  it(`saves only the fields changed`, async () => {
    render(<DashboardEditForm screenshot={screenshot} isSaving={false} />);

    fireEvent.change(cityNameInput(), { target: { value: 'New Town' } });

    await userEvent.setup().click(saveButton());

    const updates = getTriggers().filter(trigger => trigger.event == updateEvent);

    expect(updates.map(update => update.args)).toEqual([[{ cityName: 'New Town' }]]);
  });

  it(`holds the save while one is on its way`, () => {
    render(<DashboardEditForm screenshot={screenshot} isSaving={true} />);

    fireEvent.change(cityNameInput(), { target: { value: 'New Town' } });

    const saving = screen.getByRole<HTMLButtonElement>('button', {
      name: 'HallOfFame.UI.Dashboard.EDIT_ACTION[Saving]'
    });

    expect(saving.disabled).toBe(true);
  });

  it(`has nothing left to save once the saved screenshot comes back`, () => {
    const { rerender } = render(<DashboardEditForm screenshot={screenshot} isSaving={false} />);

    fireEvent.change(cityNameInput(), { target: { value: ' New Town ' } });

    rerender(
      <DashboardEditForm screenshot={{ ...screenshot, cityName: 'New Town' }} isSaving={false} />
    );

    expect(cityNameInput().value).toBe(' New Town ');
    expect(saveButton().disabled).toBe(true);
  });

  it(`offers the showcased mod alone while the playset gives none`, () => {
    render(
      <DashboardEditForm
        screenshot={{ ...screenshot, showcasedMod: makeMod({ paradoxModId: 12, name: 'Bridge' }) }}
        isSaving={false}
      />
    );

    expect(screen.getByText('Bridge')).toBeDefined();
  });

  it(`offers no asset to showcase without a playset or a showcased mod`, () => {
    render(<DashboardEditForm screenshot={screenshot} isSaving={false} />);

    expect(
      screen.queryByText('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_LABEL')
    ).toBeNull();
  });

  it(`offers the playset's asset mods`, () => {
    setBinding('hallOfFame.dashboard', 'assetMods', [makeJsonMod({ id: '34' })]);

    render(<DashboardEditForm screenshot={screenshot} isSaving={false} />);

    expect(
      screen.getByText('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_LABEL')
    ).toBeDefined();
  });
});
