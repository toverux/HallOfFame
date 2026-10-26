import { afterEach, describe, expect, it, mock } from 'bun:test';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EventInputProvider } from 'cs2/input';
import type { CreatorStats, DashboardScreenshot } from '../../common';
import { makeScreenshot, photoModeCatalog } from '../../testing/fixtures';
import {
  emitEvent,
  getTriggers,
  resetBindings,
  setBinding,
  setTranslations
} from '../../testing/game-setup';
import type { DashboardDetailState, DashboardState } from '../../utils/bindings';
import { TransitionContext } from '../../vanilla-modules/game-ui/common/animations/transition-context';
import { CreatorDashboard } from './creator-dashboard';

afterEach(() => {
  cleanup();
  resetBindings();

  // A notch holds every tooltip until the mouse moves, a test's included.
  fireEvent.mouseMove(document.body);
});

const GROUP = 'hallOfFame.dashboard';

const title = 'HallOfFame.UI.Dashboard.TITLE[Dashboard]';

function noop(): void {
  // The spy below only looks at unmounts.
}

const stats: CreatorStats = {
  screenshotsCount: 3,
  viewsCount: 0,
  uniqueViewsCount: 0,
  likesCount: 0,
  rankMinUniqueViewsCount: 30,
  rankMinLikesCount: 3
};

function closeTriggers(): number {
  return getTriggers().filter(trigger => trigger.event == `${GROUP}.close`).length;
}

describe('CreatorDashboard', () => {
  it(`shows nothing while closed`, () => {
    render(<CreatorDashboard />);

    expect(screen.queryByText(title)).toBeNull();
  });

  it(`opens when C# reports it open`, () => {
    setState({ status: 'loading' });

    render(<CreatorDashboard />);

    expect(screen.getByText(title)).toBeDefined();
  });

  it(`closes on Back, although the screen hosting it never gives it the focus`, async () => {
    // The actions the game reports as bound, which the input root reads before it listens.
    setBinding('input', 'actionNames', ['Back']);
    setLoaded([]);

    render(
      <EventInputProvider>
        <CreatorDashboard />
      </EventInputProvider>
    );

    // The input stack takes in a new consumer on the next frame, so Back is resent until it lands.
    await waitFor(() => {
      emitEvent('input.onActionPerformed.update', { action: 'Back', value: null });

      expect(closeTriggers()).toBeGreaterThan(0);
    });
  });

  it(`closes on a press on the backdrop, not on one inside the panel`, () => {
    setLoaded([]);

    render(<CreatorDashboard />);

    const titleElement = screen.getByText(title);

    act(() => {
      titleElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(closeTriggers()).toBe(0);

    // The portal mounts the backdrop straight under the body, the panel inside it.
    const backdrop = [...document.body.children].find(element => element.contains(titleElement));

    expect(backdrop).toBeDefined();

    act(() => {
      backdrop?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(closeTriggers()).toBe(1);
  });

  it(`stays out of the transition group hosting it, so closing it leaves the screen`, () => {
    const onUnmount = mock(noop);

    const groupContext = { state: 0, onMount: noop, onUnmount };

    setLoaded([]);

    const { unmount } = render(
      // oxlint-disable-next-line react/jsx-no-constructed-context-values - one fixture
      <TransitionContext.Provider value={groupContext}>
        <CreatorDashboard />
      </TransitionContext.Provider>
    );

    act(() => {
      setState({ status: 'closed' });
    });

    unmount();

    // The group would drop the child it registered the panel under: the hosting screen.
    expect(onUnmount).not.toHaveBeenCalled();
  });

  it(`closes when the screen hosting it goes`, () => {
    setLoaded([]);

    const { unmount } = render(<CreatorDashboard />);

    unmount();

    expect(closeTriggers()).toBe(1);
  });

  it(`shows each screenshot as a card, newest first, with its figures and medal state`, () => {
    setLoaded([
      makeScreenshot({
        id: 'settling',
        cityName: 'Settling City',
        createdAt: '2026-01-02T00:00:00Z',
        createdAtFormatted: '1/2/2026',
        createdAtFormattedDistance: '2 days ago',
        uniqueViewsCount: 12
      }),
      makeScreenshot({
        id: 'ranked',
        cityName: 'Ranked City',
        createdAt: '2026-01-03T00:00:00Z',
        uniqueViewsCount: 80,
        likesCount: 9,
        rank: 'gold'
      }),
      makeScreenshot({
        id: 'unranked',
        cityName: 'Unranked City',
        createdAt: '2026-01-01T00:00:00Z',
        uniqueViewsCount: 40,
        likesCount: 1
      })
    ]);

    render(<CreatorDashboard />);

    expect(cardIds()).toEqual(['ranked', 'settling', 'unranked']);

    const cards = [...document.querySelectorAll('[data-dashboard-card]')];

    const [ranked, settling, unranked] = cards;

    expect(ranked?.textContent).toContain('Ranked City');
    expect(ranked?.textContent).toContain('80');
    expect(ranked?.textContent).toContain('9');
    expect(ranked?.querySelector('[data-medal]')?.getAttribute('data-medal')).toBe('gold');
    expect(ranked?.querySelector('img')?.getAttribute('src')).toContain('gold');

    expect(settling?.textContent).toContain('2 days ago');
    expect(settling?.querySelector('[data-medal]')?.getAttribute('data-medal')).toBe('settling');
    expect(settling?.textContent).toContain('HallOfFame.UI.Dashboard.CARD[Settling Progress]');

    expect(unranked?.querySelector('[data-medal]')?.getAttribute('data-medal')).toBe('none');
    expect(unranked?.querySelector('[data-medal]')?.childElementCount).toBe(0);
  });

  it(`heads the grid with the creator's totals and a count of each medal`, () => {
    setLoaded(
      [
        makeScreenshot({ id: 'gold-1', rank: 'gold' }),
        makeScreenshot({ id: 'gold-2', rank: 'gold' }),
        makeScreenshot({ id: 'diamond', rank: 'diamond' }),
        makeScreenshot({ id: 'unranked', rank: null })
      ],
      { ...stats, viewsCount: 789, likesCount: 56 }
    );

    render(<CreatorDashboard />);

    expect(
      screen.getByText('HallOfFame.UI.Dashboard.TOTAL[Views]').parentElement?.textContent
    ).toContain('789');

    expect(
      screen.getByText('HallOfFame.UI.Dashboard.TOTAL[Likes]').parentElement?.textContent
    ).toContain('56');

    const tally = [...document.querySelectorAll('[data-tally]')].map(medal => [
      medal.getAttribute('data-tally'),
      medal.textContent
    ]);

    expect(tally).toEqual([
      ['all', '4'],
      ['unranked', '1'],
      ['bronze', '0'],
      ['silver', '0'],
      ['gold', '2'],
      ['platinum', '0'],
      ['diamond', '1']
    ]);
  });

  it(`narrows the grid to the tab picked, the whole collection until then`, () => {
    setLoaded([
      makeScreenshot({ id: 'gold', rank: 'gold' }),
      makeScreenshot({ id: 'diamond', rank: 'diamond' }),
      makeScreenshot({ id: 'unranked', rank: null })
    ]);

    render(<CreatorDashboard />);

    expect(cardIds()).toEqual(['gold', 'diamond', 'unranked']);
    expect(selectedTab()).toBe('all');

    fireEvent.click(tab('gold'));

    expect(selectedTab()).toBe('gold');
    expect(cardIds()).toEqual(['gold']);

    fireEvent.click(tab('unranked'));

    expect(cardIds()).toEqual(['unranked']);

    fireEvent.click(tab('all'));

    expect(cardIds()).toEqual(['gold', 'diamond', 'unranked']);
  });

  it(`sorts by the order picked, newest first until then`, async () => {
    setLoaded([
      makeScreenshot({ id: 'older', createdAt: '2026-01-01T00:00:00Z', likesCount: 9 }),
      makeScreenshot({ id: 'newer', createdAt: '2026-01-02T00:00:00Z', likesCount: 1 })
    ]);

    render(<CreatorDashboard />);

    expect(cardIds()).toEqual(['newer', 'older']);

    fireEvent.click(sortToggle());

    // The toggle also holds every label, unseen, for its width: the menu's copy is the other one.
    fireEvent.click(
      await screen.findByText('HallOfFame.UI.Dashboard.SORT[Most Liked]', {
        ignore: '[data-sort] *'
      })
    );

    expect(sortToggle().getAttribute('data-sort')).toBe('mostLiked');
    expect(cardIds()).toEqual(['older', 'newer']);
  });

  it(`shows the loading state while the collection is fetched`, () => {
    setState({ status: 'loading' });

    render(<CreatorDashboard />);

    expect(dashboardState()).toBe('loading');
    expect(screen.getByText('HallOfFame.Common.LOADING')).toBeDefined();
    // The band's shape stands in while the figures are fetched.
    expect(document.querySelector('[data-dashboard-skeleton]')).not.toBeNull();
    expect(document.querySelector('[data-tally]')).toBeNull();
  });

  it(`shows why the fetch failed, with a retry fetching again`, () => {
    setState({
      status: 'error',
      error: {
        id: 'SOME_ERROR',
        value: 'Some error',
        args: null
      }
    });

    render(<CreatorDashboard />);

    expect(dashboardState()).toBe('error');
    // The mock localization falls back to the message the C# side sent along.
    expect(screen.getByText('Some error')).toBeDefined();

    fireEvent.click(screen.getByText('HallOfFame.UI.Dashboard.ACTION[Retry]'));

    expect(getTriggers().filter(trigger => trigger.event == `${GROUP}.refresh`)).toHaveLength(1);
  });

  it(`shows an empty collection with its totals, and no order to pick`, () => {
    setLoaded([], { ...stats, screenshotsCount: 0 });

    render(<CreatorDashboard />);

    expect(dashboardState()).toBe('empty');
    expect(screen.getByText('HallOfFame.UI.Dashboard.TOTAL[Views]')).toBeDefined();
    expect(document.querySelector('[data-sort]')).toBeNull();
  });

  it(`badges a reported screenshot as under review, and only that one`, async () => {
    setLoaded([
      makeScreenshot({ id: 'reported', isReported: true }),
      makeScreenshot({ id: 'clear' })
    ]);

    render(<CreatorDashboard />);

    expect(card('reported').querySelector('[data-under-review]')).not.toBeNull();
    expect(card('clear').querySelector('[data-under-review]')).toBeNull();

    hover(card('reported').querySelector('[data-under-review]'));

    expect(
      await screen.findByText('HallOfFame.UI.Dashboard.CARD_TOOLTIP[Under Review]')
    ).toBeDefined();
  });

  it(`explains a ranked card's figures, its like rate included`, async () => {
    renderCard(makeScreenshot({ id: 'card', rank: 'gold', uniqueViewsCount: 80 }));

    hover(card('card').querySelector('[data-card-stats]'));

    expect(await screen.findByText(viewsTooltip)).toBeDefined();
    expect(screen.getByText(/CARD_TOOLTIP\[Viewer Clicks\]/u)).toBeDefined();
    expect(screen.getByText(likeRateTooltip)).toBeDefined();
  });

  it(`gives the like rate from the card's own likes and unique views`, async () => {
    setTranslations({
      'HallOfFame.UI.Dashboard.CARD_TOOLTIP[Like Rate]': 'Rate {LIKING_PERCENTAGE}%'
    });

    renderCard(
      makeScreenshot({
        id: 'card',
        rank: 'gold',
        likesCount: 9,
        uniqueViewsCount: 80
      })
    );

    hover(card('card').querySelector('[data-card-stats]'));

    // The tooltip's strings are text nodes of one element, which no text matcher splits apart.
    await waitFor(() => expect(document.body.textContent).toContain('Rate 11%'));
  });

  it(`leaves the like rate out of an unranked card's figures`, async () => {
    renderCard(makeScreenshot({ id: 'card', uniqueViewsCount: 12 }));

    hover(card('card').querySelector('[data-card-stats]'));

    expect(await screen.findByText(viewsTooltip)).toBeDefined();
    expect(screen.queryByText(likeRateTooltip)).toBeNull();
  });

  it(`explains a medal, its band and the slideshow's Popular pick`, async () => {
    renderCard(makeScreenshot({ id: 'card', rank: 'platinum' }));

    hover(card('card').querySelector('[data-medal]'));

    expect(await screen.findByText('HallOfFame.UI.Dashboard.MEDAL[Platinum]')).toBeDefined();
    expect(screen.getByText('HallOfFame.UI.Dashboard.MEDAL_TOOLTIP[Platinum Band]')).toBeDefined();
    expect(screen.getByText('HallOfFame.UI.Dashboard.MEDAL_TOOLTIP[Popular]')).toBeDefined();
  });

  it(`explains a Settling screenshot's wait for viewers`, async () => {
    renderCard(makeScreenshot({ id: 'card', uniqueViewsCount: 12 }));

    hover(card('card').querySelector('[data-medal]'));

    expect(await screen.findByText(/MEDAL_TOOLTIP\[Settling\]/u)).toBeDefined();
  });

  it(`explains the likes a medal takes over an empty slot`, async () => {
    renderCard(makeScreenshot({ id: 'card', uniqueViewsCount: 40 }));

    hover(card('card').querySelector('[data-medal]'));

    expect(await screen.findByText(/MEDAL_TOOLTIP\[No Medal\]/u)).toBeDefined();
  });

  it(`opens a card's detail view when the card is selected`, () => {
    renderCard(makeScreenshot({ id: 'a' }));

    fireEvent.click(card('a'));

    expect(triggersOf('openDetail')).toEqual([['a']]);
  });

  it(`shows the detail over the grid, from the collection's figures while it loads`, () => {
    setTranslations({
      'HallOfFame.UI.Dashboard.DETAIL_STAT_VALUE[Like Rate]': '{LIKING_PERCENTAGE}%'
    });

    setLoaded([
      makeScreenshot({
        id: 'a',
        cityName: 'Detail City',
        uniqueViewsCount: 80,
        viewsCount: 120,
        likesCount: 20,
        viewerClicksCount: 7,
        rank: 'gold'
      })
    ]);

    setDetail({ status: 'loading', screenshotId: 'a' });

    render(<CreatorDashboard />);

    const detail = query('[data-dashboard-detail="a"]');

    // The band names the screenshot rather than the collection's standing.
    expect(document.querySelector('[data-tally]')).toBeNull();
    expect(query('[data-dashboard-back]').parentElement?.textContent).toContain('Detail City');

    expect(statText('uniqueViews')).toContain('80');
    expect(statText('views')).toContain('120');
    expect(statText('likes')).toContain('20');
    expect(statText('viewerClicks')).toContain('7');
    // 20 likes over 80 unique viewers, as the card's tooltip rounds it.
    expect(statText('likeRate')).toContain('25%');
    expect(statText('likeRate')).toContain('DETAIL_STAT_DESCRIPTION[Like Rate]');

    expect(detail.querySelector('[data-medal]')?.getAttribute('data-medal')).toBe('gold');
    expect(detail.querySelector('[data-dashboard-state="loading"]')).not.toBeNull();
    expect(detail.querySelector('[data-under-review-notice]')).toBeNull();

    // The grid stays mounted under it, so going back finds it where it was scrolled to.
    expect(cardIds()).toEqual(['a']);
  });

  it(`places the screenshot in the Best medal order, alone in its collection never`, () => {
    setTranslations({
      'HallOfFame.UI.Dashboard.DETAIL_STAT_VALUE[Collection Place]': '#{PLACE}',
      'HallOfFame.UI.Dashboard.DETAIL_STAT_DESCRIPTION[Collection Place]':
        'Among {SCREENSHOTS_COUNT}.'
    });

    setLoaded([
      makeScreenshot({ id: 'a', rank: 'gold' }),
      makeScreenshot({ id: 'b', rank: 'diamond' })
    ]);
    setDetail({ status: 'loading', screenshotId: 'a' });

    const { unmount } = render(<CreatorDashboard />);

    expect(statText('collectionPlace')).toContain('#2');
    expect(statText('collectionPlace')).toContain('Among 2.');

    unmount();

    setLoaded([makeScreenshot({ id: 'a' })]);

    render(<CreatorDashboard />);

    expect(document.querySelector('[data-stat="collectionPlace"]')).toBeNull();
  });

  it(`leaves the like rate out of an unranked screenshot's detail`, () => {
    setLoaded([makeScreenshot({ id: 'a', uniqueViewsCount: 40, likesCount: 1 })]);
    setDetail({ status: 'loading', screenshotId: 'a' });

    render(<CreatorDashboard />);

    expect(document.querySelector('[data-stat="likeRate"]')).toBeNull();
    expect(query('[data-dashboard-detail] [data-medal]').getAttribute('data-medal')).toBe('none');
  });

  it(`explains in plain view why a reported screenshot is under review`, () => {
    setLoaded([makeScreenshot({ id: 'a', isReported: true })]);
    setDetail({ status: 'loading', screenshotId: 'a' });

    render(<CreatorDashboard />);

    expect(query('[data-under-review-notice]').textContent).toContain(
      'HallOfFame.UI.Dashboard.CARD_TOOLTIP[Under Review]'
    );
  });

  it(`shows the full image once the full screenshot is loaded`, () => {
    setLoaded([makeScreenshot({ id: 'a', imageUrlThumbnail: 'thumbnail.jpg' })]);
    setDetail({
      status: 'loaded',
      isSaving: false,
      isDeleting: false,
      screenshotId: 'a',
      screenshot: makeScreenshot({ id: 'a', imageUrlFHD: 'full.jpg' })
    });

    render(<CreatorDashboard />);

    const detail = query('[data-dashboard-detail="a"]');

    expect(detail.innerHTML).toContain('full.jpg');
    expect(detail.innerHTML).toContain('thumbnail.jpg');
    expect(detail.querySelector('[data-dashboard-state]')).toBeNull();
  });

  it(`captions the image with the city's facts once the full screenshot is loaded`, () => {
    setTranslations({
      'HallOfFame.UI.Dashboard.DETAIL_FACT[Playset]': '{MODS_COUNT} mods',
      'HallOfFame.UI.Dashboard.DETAIL_FACT[Photo Settings]': '{SETTINGS_COUNT} photo settings',
      'Progression.MILESTONE_NAME:5': 'Small City'
    });

    setBinding('hallOfFame.slideshow', 'photoModeCatalog', photoModeCatalog);
    setLoaded([makeScreenshot({ id: 'a' })]);
    setDetail({ status: 'loading', screenshotId: 'a' });

    render(<CreatorDashboard />);

    expect(document.querySelector('[data-dashboard-detail] [data-fact]')).toBeNull();

    act(() => {
      setDetail({
        status: 'loaded',
        isSaving: false,
        isDeleting: false,
        screenshotId: 'a',
        screenshot: makeScreenshot({
          id: 'a',
          cityMilestone: 5,
          cityPopulation: 1200,
          mapName: 'Volchoria',
          createdAtFormatted: '03/09/2026',
          capabilities: ['paradoxModIds', 'renderSettings'],
          paradoxModIds: [1, 2],
          shareParadoxModIds: true,
          shareRenderSettings: true,
          renderSettings: { 'PhotoModeRenderSystem.iso': 400 }
        })
      });
    });

    const detail = query('[data-dashboard-detail="a"]');

    expect(detail.textContent).toContain('Small City');
    expect(detail.textContent).toContain('Volchoria');
    expect(detail.textContent).toContain('03/09/2026');
    expect(query('[data-fact="playset"]').textContent).toBe('2 mods');
    expect(query('[data-fact="photoSettings"]').textContent).toBe('1 photo settings');
  });

  it(`leaves out the photo settings and the playset a screenshot does not carry`, () => {
    setLoaded([makeScreenshot({ id: 'a' })]);
    setDetail({
      status: 'loaded',
      isSaving: false,
      isDeleting: false,
      screenshotId: 'a',
      // Mod IDs from before the playset was recorded, which the details window does not list.
      screenshot: makeScreenshot({
        id: 'a',
        mapName: 'Volchoria',
        paradoxModIds: [1],
        shareParadoxModIds: true
      })
    });

    render(<CreatorDashboard />);

    expect(query('[data-dashboard-detail="a"]').textContent).toContain('Volchoria');
    expect(document.querySelector('[data-fact="playset"]')).toBeNull();
    expect(document.querySelector('[data-fact="photoSettings"]')).toBeNull();
  });

  it(`leaves out the photo settings and the playset the creator did not share`, () => {
    setBinding('hallOfFame.slideshow', 'photoModeCatalog', photoModeCatalog);
    setLoaded([makeScreenshot({ id: 'a' })]);
    setDetail({
      status: 'loaded',
      isSaving: false,
      isDeleting: false,
      screenshotId: 'a',
      // The server keeps both for their creator, but the details window lists neither.
      screenshot: makeScreenshot({
        id: 'a',
        capabilities: ['paradoxModIds', 'renderSettings'],
        paradoxModIds: [1, 2],
        shareParadoxModIds: false,
        shareRenderSettings: false,
        renderSettings: { 'PhotoModeRenderSystem.iso': 400 }
      })
    });

    render(<CreatorDashboard />);

    expect(document.querySelector('[data-fact="playset"]')).toBeNull();
    expect(document.querySelector('[data-fact="photoSettings"]')).toBeNull();
  });

  it(`opens the details window on the playset from its fact`, () => {
    setLoadedWithDetails();

    render(<CreatorDashboard />);

    fireEvent.click(query('[data-fact="playset"] > *'));

    // The playset tab asks the mod for the screenshot's playset as it opens.
    expect(
      getTriggers()
        .filter(trigger => trigger.event == 'hallOfFame.slideshow.loadPlayset')
        .map(trigger => trigger.args)
    ).toEqual([['a']]);
    expect(screen.queryByText(photoModeNotice)).toBeNull();
  });

  it(`opens the details window on the photo settings from their fact`, () => {
    setLoadedWithDetails();

    render(<CreatorDashboard />);

    fireEvent.click(query('[data-fact="photoSettings"] > *'));

    expect(screen.getByText(photoModeNotice)).toBeDefined();
  });

  it(`retries a failed detail fetch on the same screenshot`, () => {
    setLoaded([makeScreenshot({ id: 'a' })]);
    setDetail({
      status: 'error',
      screenshotId: 'a',
      error: { id: 'SOME_ERROR', value: 'Some error', args: null }
    });

    render(<CreatorDashboard />);

    expect(screen.getByText('HallOfFame.UI.Dashboard.DETAIL_ERROR_TITLE')).toBeDefined();

    fireEvent.click(screen.getByText('HallOfFame.UI.Dashboard.ACTION[Retry]'));

    expect(triggersOf('openDetail')).toEqual([['a']]);
  });

  it(`goes back to the grid from the band's Back button`, () => {
    setLoaded([makeScreenshot({ id: 'a' })]);
    setDetail({ status: 'loading', screenshotId: 'a' });

    render(<CreatorDashboard />);

    fireEvent.click(query('[data-dashboard-back]'));

    expect(triggersOf('closeDetail')).toHaveLength(1);
    expect(closeTriggers()).toBe(0);
  });

  it(`keeps the detail on screen while the panel closing from it plays its exit`, () => {
    setLoaded([makeScreenshot({ id: 'a' })]);
    setDetail({ status: 'loading', screenshotId: 'a' });

    render(<CreatorDashboard />);

    // C# closes the dashboard, then its detail.
    act(() => {
      setState({ status: 'closed' });
    });

    act(() => {
      setDetail({ status: 'closed' });
    });

    expect(document.querySelector('[data-dashboard-detail="a"]')).not.toBeNull();
    expect(document.querySelector('[data-tally]')).toBeNull();
  });

  it(`goes back to the grid on Back, rather than closing`, async () => {
    setBinding('input', 'actionNames', ['Back']);
    setLoaded([makeScreenshot({ id: 'a' })]);
    setDetail({ status: 'loading', screenshotId: 'a' });

    render(
      <EventInputProvider>
        <CreatorDashboard />
      </EventInputProvider>
    );

    await waitFor(() => {
      emitEvent('input.onActionPerformed.update', { action: 'Back', value: null });

      expect(triggersOf('closeDetail').length).toBeGreaterThan(0);
    });

    expect(closeTriggers()).toBe(0);
  });
});

// Their arguments render beside their ids.
const viewsTooltip = /CARD_TOOLTIP\[Views\]/u;

const likeRateTooltip = /CARD_TOOLTIP\[Like Rate\]/u;

function renderCard(screenshot: DashboardScreenshot): void {
  setLoaded([screenshot]);

  render(<CreatorDashboard />);
}

function setState(state: DashboardState): void {
  setBinding(GROUP, 'state', state);
}

const photoModeNotice = 'HallOfFame.UI.Menu.ScreenshotDetails.PHOTO_MODE_SETTINGS[Notice]';

// A loaded detail whose screenshot shares a playset and photo settings, both opening the window.
function setLoadedWithDetails(): void {
  setBinding('hallOfFame.slideshow', 'photoModeCatalog', photoModeCatalog);
  setLoaded([makeScreenshot({ id: 'a' })]);
  setDetail({
    status: 'loaded',
    isSaving: false,
    isDeleting: false,
    screenshotId: 'a',
    screenshot: makeScreenshot({
      id: 'a',
      capabilities: ['paradoxModIds', 'renderSettings'],
      paradoxModIds: [1],
      shareParadoxModIds: true,
      shareRenderSettings: true,
      renderSettings: { 'PhotoModeRenderSystem.iso': 400 }
    })
  });
}

function setDetail(detail: DashboardDetailState): void {
  setBinding(GROUP, 'detail', detail);
}

function setLoaded(
  screenshots: readonly DashboardScreenshot[],
  loadedStats: CreatorStats = stats
): void {
  setState({ status: 'loaded', screenshots, stats: loadedStats });
}

function triggersOf(name: string): ReadonlyArray<readonly unknown[]> {
  return getTriggers()
    .filter(trigger => trigger.event == `${GROUP}.${name}`)
    .map(trigger => trigger.args);
}

function statText(name: string): string | null {
  return query(`[data-stat="${name}"]`).textContent;
}

function cardIds(): Array<string | null> {
  return [...document.querySelectorAll('[data-dashboard-card]')].map(element =>
    element.getAttribute('data-dashboard-card')
  );
}

function card(id: string): Element {
  return query(`[data-dashboard-card="${id}"]`);
}

function hover(element: Element | null): void {
  if (element == null) {
    throw new Error(`Nothing to hover.`);
  }

  fireEvent.mouseOver(element);
}

function tab(filter: string): Element {
  return query(`[data-tally="${filter}"]`);
}

function selectedTab(): string | null | undefined {
  return document.querySelector('[data-selected="true"]')?.getAttribute('data-tally');
}

function sortToggle(): Element {
  return query('[data-sort]');
}

function query(selector: string): Element {
  const element = document.querySelector(selector);

  if (element == null) {
    throw new Error(`Nothing matches ${selector}.`);
  }

  return element;
}

function dashboardState(): string | null | undefined {
  return document.querySelector('[data-dashboard-state]')?.getAttribute('data-dashboard-state');
}
