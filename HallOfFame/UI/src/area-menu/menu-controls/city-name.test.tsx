import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, type RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCreator, makeScreenshot, makeSettings } from '../../testing/fixtures';
import { getTriggers, resetBindings, setBinding, setTranslations } from '../../testing/game-setup';
import { MenuControlsCityName } from './city-name';

afterEach(() => {
  cleanup();
  resetBindings();
});

// `translate()` echoes the id when it knows no better, so a menu item's label is its id.
const openLabel = 'HallOfFame.UI.Menu.MenuControls.LINK_ACTION[Open]';
const copyLabel = 'HallOfFame.UI.Menu.MenuControls.LINK_ACTION[Copy]';
const copiedLabel = 'HallOfFame.UI.Menu.MenuControls.LINK_ACTION[Copied]';

const openEvent = 'hallOfFame.common.openViewerLink';
const copyEvent = 'hallOfFame.common.copyViewerLink';

const screenshot = makeScreenshot({
  id: 'screenshot-1',
  cityName: 'Springfield',
  viewerUrl: 'https://api.test/screenshots/screenshot-1/viewer',
  viewerShareUrl: 'https://viewer.test/city/screenshot-1',
  creator: makeCreator({
    id: 'creator-1',
    creatorName: 'Alice',
    viewerUrl: 'https://api.test/creators/creator-1/viewer',
    viewerShareUrl: 'https://viewer.test/?creator=creator-1'
  })
});

function renderCityName(overrides: Partial<typeof screenshot> = {}): RenderResult {
  setBinding('hallOfFame.common', 'locale', 'en-US');
  setBinding('hallOfFame.common', 'settings', makeSettings());

  // Without this, `translate` echoes the id and the creator line reads as the key rather than as
  // the phrase the tests match on.
  setTranslations({ 'HallOfFame.Common.CITY_BY': 'by {CREATOR_NAME}' });

  return render(<MenuControlsCityName screenshot={{ ...screenshot, ...overrides }} />);
}

/**
 * Returns the clickable text, which is the menu's toggle: the city name, or the whole "by …"
 * phrase on the creator side.
 * `getByText` matches on an element's own text nodes, so this lands on the toggle rather than on
 * the tooltip wrapper around it.
 */
function getName(text: string): HTMLElement {
  return screen.getByText(text);
}

/**
 * The menu items, found by tag rather than by class: SCSS modules resolve to `undefined` under bun,
 * so the mod's own class names never reach the DOM here. Both toggles being spans, the only buttons
 * in the tree are the items of an open menu.
 */
function getMenuItems(): readonly Element[] {
  return Array.from(document.querySelectorAll('button'));
}

describe('MenuControlsCityName', () => {
  it(`opens a menu with exactly two items when the city name is clicked`, async () => {
    renderCityName();

    expect(screen.queryByText(openLabel)).toBeNull();

    await userEvent.setup().click(getName('Springfield'));

    expect(screen.getByText(openLabel)).toBeDefined();
    expect(screen.getByText(copyLabel)).toBeDefined();
    expect(getMenuItems()).toHaveLength(2);
  });

  it(`opens a menu with exactly two items when the creator name is clicked`, async () => {
    renderCityName();

    await userEvent.setup().click(getName('by Alice'));

    expect(screen.getByText(openLabel)).toBeDefined();
    expect(screen.getByText(copyLabel)).toBeDefined();
    expect(getMenuItems()).toHaveLength(2);
  });

  it(`makes the whole "by …" phrase the creator click target`, () => {
    renderCityName();

    // Cohtml never fragments an element across line boxes, so wrapping the name alone would make
    // it a box starting mid-sentence and break how the line wraps. The phrase stays one text run,
    // and the price is that "by" is part of the target.
    expect(getName('by Alice').textContent).toBe('by Alice');
  });

  it(`opens the tracked viewer URL of the screenshot from the city menu`, async () => {
    renderCityName();

    const user = userEvent.setup();

    await user.click(getName('Springfield'));
    await user.click(screen.getByText(openLabel));

    expect(getTriggers().filter(({ event }) => event == openEvent)).toEqual([
      { event: openEvent, args: ['https://api.test/screenshots/screenshot-1/viewer'] }
    ]);
  });

  it(`opens the tracked viewer URL of the creator from the creator menu`, async () => {
    renderCityName();

    const user = userEvent.setup();

    await user.click(getName('by Alice'));
    await user.click(screen.getByText(openLabel));

    expect(getTriggers().filter(({ event }) => event == openEvent)).toEqual([
      { event: openEvent, args: ['https://api.test/creators/creator-1/viewer'] }
    ]);
  });

  it(`copies the clean viewer URL of the screenshot, not the tracked one`, async () => {
    renderCityName();

    const user = userEvent.setup();

    await user.click(getName('Springfield'));
    await user.click(screen.getByText(copyLabel));

    expect(getTriggers().filter(({ event }) => event == copyEvent)).toEqual([
      { event: copyEvent, args: ['https://viewer.test/city/screenshot-1'] }
    ]);
  });

  it(`copies the clean viewer URL of the creator, not the tracked one`, async () => {
    renderCityName();

    const user = userEvent.setup();

    await user.click(getName('by Alice'));
    await user.click(screen.getByText(copyLabel));

    expect(getTriggers().filter(({ event }) => event == copyEvent)).toEqual([
      { event: copyEvent, args: ['https://viewer.test/?creator=creator-1'] }
    ]);
  });

  it(`keeps the menu open after a copy and confirms it in place`, async () => {
    renderCityName();

    const user = userEvent.setup();

    await user.click(getName('Springfield'));
    await user.click(screen.getByText(copyLabel));

    expect(screen.getByText(copiedLabel)).toBeDefined();
    expect(screen.queryByText(copyLabel)).toBeNull();

    // Still open, so the player can go on to open the link without reopening the menu.
    expect(screen.getByText(openLabel)).toBeDefined();
    expect(getMenuItems()).toHaveLength(2);
  });

  it(`closes the menu when the displayed screenshot changes`, async () => {
    const { rerender } = renderCityName();

    await userEvent.setup().click(getName('Springfield'));

    expect(screen.getByText(openLabel)).toBeDefined();

    rerender(
      <MenuControlsCityName
        screenshot={{ ...screenshot, id: 'screenshot-2', cityName: 'Shelbyville' }}
      />
    );

    expect(screen.getByText('Shelbyville')).toBeDefined();
    expect(screen.queryByText(openLabel)).toBeNull();
  });

  it(`still opens the menu for an anonymous creator`, async () => {
    renderCityName({ creator: makeCreator({ id: 'creator-2' }) });

    await userEvent.setup().click(getName('by anonymous'));

    expect(screen.getByText(openLabel)).toBeDefined();
    expect(screen.getByText(copyLabel)).toBeDefined();
  });

  it(`opens the menu on a translated name too`, async () => {
    renderCityName({
      cityName: 'Ville-Lumière',
      cityNameTranslated: 'City of Light',
      cityNameLocale: 'fr-FR'
    });

    await userEvent.setup().click(getName('City of Light'));

    expect(screen.getByText(openLabel)).toBeDefined();
    expect(screen.getByText(copyLabel)).toBeDefined();
  });
});

// Not covered here: anything about the translation tooltip, which is suppressed while the menu is
// open and released again when the screenshot changes under an open one.
// The balloon behind `Tooltip` renders nothing at all under this harness, `forceVisible` included,
// because it portals into a container only the booted game app creates. An assertion that it is
// absent would therefore pass whether or not the suppression works, and the release is invisible
// for the same reason: the menu reopens either way, so a test driving it would prove nothing.
// Both are verified in the running game.
