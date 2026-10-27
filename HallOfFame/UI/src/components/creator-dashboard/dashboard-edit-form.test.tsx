import { afterEach, describe, expect, it } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeJsonMod, makeMod, makeScreenshot, noop } from '../../testing/fixtures';
import { getTriggers, resetBindings, setBinding } from '../../testing/game-setup';
import { DashboardEditForm } from './dashboard-edit-form';

afterEach(() => {
  cleanup();
  resetBindings();
});

const updateEvent = 'hallOfFame.dashboard.update';

const deleteEvent = 'hallOfFame.dashboard.delete';

const showEvent = 'hallOfFame.dashboard.showInSlideshow';

const openViewerEvent = 'hallOfFame.common.openViewerLink';

// `translate()` returns the id when no fallback is given, so a label is its id.
const saveLabel = 'HallOfFame.UI.Dashboard.EDIT_ACTION[Save]';

const savedLabel = 'HallOfFame.UI.Dashboard.EDIT_ACTION[Saved]';

const deleteLabel = 'HallOfFame.UI.Dashboard.EDIT_ACTION[Delete]';

const showLabel = 'HallOfFame.UI.Dashboard.EDIT_ACTION[Show in Slideshow]';

const openViewerLabel = 'HallOfFame.UI.Dashboard.EDIT_ACTION[Open in Web Viewer]';

const screenshot = makeScreenshot({
  id: 'a',
  cityName: 'Old Town',
  description: 'A quiet harbour.',
  shareParadoxModIds: true,
  shareRenderSettings: false
});

type FormProps = Parameters<typeof DashboardEditForm>[0];

function renderForm(props: Partial<FormProps> = {}): ReturnType<typeof render> {
  return render(
    <DashboardEditForm
      screenshot={screenshot}
      isSaving={false}
      isDeleting={false}
      onHasChangesChange={noop}
      {...props}
    />
  );
}

function saveButton(): HTMLButtonElement {
  return screen.getByRole<HTMLButtonElement>('button', { name: saveLabel });
}

// The other actions sit in the More menu, opened first.
async function openActionsMenu(): Promise<void> {
  await userEvent
    .setup()
    .click(screen.getByRole('button', { name: 'HallOfFame.UI.Dashboard.EDIT_ACTION[More]' }));
}

function triggered(event: string): ReadonlyArray<readonly unknown[]> {
  return getTriggers()
    .filter(trigger => trigger.event == event)
    .map(trigger => trigger.args);
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
    renderForm();

    expect(cityNameInput().value).toBe('Old Town');
    expect(saveButton().disabled).toBe(true);
  });

  it(`saves only the fields changed`, async () => {
    renderForm();

    fireEvent.change(cityNameInput(), { target: { value: 'New Town' } });

    await userEvent.setup().click(saveButton());

    expect(triggered(updateEvent)).toEqual([[{ cityName: 'New Town' }]]);
  });

  it(`holds the save while one is on its way`, () => {
    renderForm({ isSaving: true });

    fireEvent.change(cityNameInput(), { target: { value: 'New Town' } });

    const saving = screen.getByRole<HTMLButtonElement>('button', {
      name: 'HallOfFame.UI.Dashboard.EDIT_ACTION[Saving]'
    });

    expect(saving.disabled).toBe(true);
  });

  it(`has nothing left to save once the saved screenshot comes back`, () => {
    const { rerender } = renderForm();

    fireEvent.change(cityNameInput(), { target: { value: ' New Town ' } });

    rerender(
      <DashboardEditForm
        screenshot={{ ...screenshot, cityName: 'New Town' }}
        isSaving={false}
        isDeleting={false}
        onHasChangesChange={noop}
      />
    );

    expect(cityNameInput().value).toBe(' New Town ');
    expect(saveButton().disabled).toBe(true);
  });

  it(`reports its edits as they come and go, and none once gone`, () => {
    const reports: boolean[] = [];

    const { unmount } = renderForm({
      onHasChangesChange: hasChanges => {
        reports.push(hasChanges);
      }
    });

    fireEvent.change(cityNameInput(), { target: { value: 'New Town' } });
    fireEvent.change(cityNameInput(), { target: { value: 'Old Town' } });
    fireEvent.change(cityNameInput(), { target: { value: 'New Town' } });

    unmount();

    expect(reports).toEqual([false, true, false, true, false]);
  });

  it(`says Saved once a save lands`, () => {
    const { rerender } = renderForm();

    fireEvent.change(cityNameInput(), { target: { value: 'New Town' } });

    const saved = { ...screenshot, cityName: 'New Town' };

    rerender(
      <DashboardEditForm
        screenshot={screenshot}
        isSaving={true}
        isDeleting={false}
        onHasChangesChange={noop}
      />
    );

    rerender(
      <DashboardEditForm
        screenshot={saved}
        isSaving={false}
        isDeleting={false}
        onHasChangesChange={noop}
      />
    );

    expect(screen.getByRole<HTMLButtonElement>('button', { name: savedLabel }).disabled).toBe(true);

    // The next edit is a new one to save.
    fireEvent.change(cityNameInput(), { target: { value: 'Newer Town' } });

    expect(saveButton().disabled).toBe(false);
  });

  it(`keeps the edits to save again once a save fails`, () => {
    const { rerender } = renderForm();

    fireEvent.change(cityNameInput(), { target: { value: 'New Town' } });

    for (const isSaving of [true, false]) {
      rerender(
        <DashboardEditForm
          screenshot={screenshot}
          isSaving={isSaving}
          isDeleting={false}
          onHasChangesChange={noop}
        />
      );
    }

    expect(saveButton().disabled).toBe(false);
    expect(screen.queryByRole('button', { name: savedLabel })).toBeNull();
  });

  it(`offers the showcased mod alone while the playset gives none`, () => {
    renderForm({
      screenshot: { ...screenshot, showcasedMod: makeMod({ paradoxModId: 12, name: 'Bridge' }) }
    });

    expect(screen.getByText('Bridge')).toBeDefined();
  });

  it(`offers no asset to showcase without a playset or a showcased mod`, () => {
    renderForm();

    expect(
      screen.queryByText('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_LABEL')
    ).toBeNull();
  });

  it(`offers the playset's asset mods`, () => {
    setBinding('hallOfFame.dashboard', 'assetMods', [makeJsonMod({ id: '34' })]);

    renderForm();

    expect(
      screen.getByText('HallOfFame.UI.Game.ScreenshotUploadPanel.FORM_SHOWCASE_ASSET_LABEL')
    ).toBeDefined();
  });

  it(`asks for the deletion, to the bulldozer's sound`, async () => {
    renderForm();

    await openActionsMenu();
    await userEvent.setup().click(screen.getByText(deleteLabel));

    expect(triggered(deleteEvent)).toEqual([[]]);
    expect(triggered('audio.playSound')).toContainEqual(['bulldoze', 1]);
  });

  it(`holds every mutation while the deletion is on its way`, async () => {
    renderForm({ isDeleting: true });

    fireEvent.change(cityNameInput(), { target: { value: 'New Town' } });

    expect(saveButton().disabled).toBe(true);

    await openActionsMenu();
    await userEvent
      .setup()
      .click(screen.getByText('HallOfFame.UI.Dashboard.EDIT_ACTION[Deleting]'));
    await userEvent.setup().click(screen.getByText(showLabel));

    expect(triggered(deleteEvent)).toEqual([]);
    expect(triggered(showEvent)).toEqual([]);
  });

  it(`opens the screenshot's Web Viewer page, through the tracked link`, async () => {
    renderForm();

    await openActionsMenu();
    await userEvent.setup().click(screen.getByText(openViewerLabel));

    expect(triggered(openViewerEvent)).toEqual([[screenshot.viewerUrl]]);
  });

  it(`shows the screenshot in the slideshow, from the main menu alone`, async () => {
    renderForm();

    await openActionsMenu();
    await userEvent.setup().click(screen.getByText(showLabel));

    expect(triggered(showEvent)).toEqual([[]]);

    cleanup();
    setBinding('hallOfFame.slideshow', 'isInMainMenu', false);

    renderForm();

    await openActionsMenu();

    expect(screen.queryByText(showLabel)).toBeNull();
  });

  it(`keeps its actions menu when the game leaves the main menu`, async () => {
    renderForm();

    act(() => setBinding('hallOfFame.slideshow', 'isInMainMenu', false));

    await openActionsMenu();

    expect(screen.queryByText(showLabel)).toBeNull();
    expect(screen.getByText(openViewerLabel)).toBeDefined();
  });

  it(`offers no slideshow while the settings turn it off`, async () => {
    setBinding('hallOfFame.slideshow', 'enableMainMenuSlideshow', false);

    renderForm();

    await openActionsMenu();

    expect(screen.queryByText(showLabel)).toBeNull();
  });
});
