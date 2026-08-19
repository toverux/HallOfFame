import { afterEach, describe, expect, it } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import type { CreatorSocialLink } from '../../common';
import { makeCreator, makeScreenshot, makeSettings } from '../../testing/fixtures';
import { resetBindings, setBinding } from '../../testing/game-setup';
import { MenuControlsSocialsPreloader } from './socials-preloader';

afterEach(() => {
  cleanup();
  resetBindings();
});

function setNextNeighbor(socials: readonly CreatorSocialLink[] | null): void {
  setBinding(
    'hallOfFame.slideshow',
    'nextNeighbor',
    socials && makeScreenshot({ creator: makeCreator({ socials }) })
  );
}

function preloadedSrcs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('img'), img => img.getAttribute('src') ?? '');
}

describe('MenuControlsSocialsPreloader', () => {
  it(`preloads the logos of the platforms the next screenshot's creator links`, () => {
    setBinding('hallOfFame.common', 'settings', makeSettings({ showCreatorSocials: true }));
    setNextNeighbor([
      { platform: 'discord', link: 'https://discord.test/x' },
      { platform: 'youtube', link: 'https://youtube.test/x' }
    ]);

    const { container } = render(<MenuControlsSocialsPreloader />);

    const srcs = preloadedSrcs(container);

    expect(srcs).toHaveLength(2);
    expect(srcs.some(src => src.includes('discord'))).toBe(true);
    expect(srcs.some(src => src.includes('youtube'))).toBe(true);
    expect(srcs.some(src => src.includes('twitch'))).toBe(false);
  });

  it(`preloads nothing when the creator links no platform`, () => {
    setBinding('hallOfFame.common', 'settings', makeSettings({ showCreatorSocials: true }));
    setNextNeighbor([]);

    const { container } = render(<MenuControlsSocialsPreloader />);

    expect(preloadedSrcs(container)).toHaveLength(0);
  });

  it(`preloads nothing when there is no next screenshot to read ahead to`, () => {
    setBinding('hallOfFame.common', 'settings', makeSettings({ showCreatorSocials: true }));
    setNextNeighbor(null);

    const { container } = render(<MenuControlsSocialsPreloader />);

    expect(preloadedSrcs(container)).toHaveLength(0);
  });

  it(`preloads nothing when the player turned the socials off, since none will be shown`, () => {
    setBinding('hallOfFame.common', 'settings', makeSettings({ showCreatorSocials: false }));
    setNextNeighbor([{ platform: 'discord', link: 'https://discord.test/x' }]);

    const { container } = render(<MenuControlsSocialsPreloader />);

    expect(preloadedSrcs(container)).toHaveLength(0);
  });

  it(`keeps the logos of the slides already gone by, so going back does not refetch them`, () => {
    setBinding('hallOfFame.common', 'settings', makeSettings({ showCreatorSocials: true }));
    setNextNeighbor([{ platform: 'discord', link: 'https://discord.test/x' }]);

    const { container } = render(<MenuControlsSocialsPreloader />);

    act(() => setNextNeighbor([{ platform: 'youtube', link: 'https://youtube.test/x' }]));

    const srcs = preloadedSrcs(container);

    expect(srcs).toHaveLength(2);
    expect(srcs.some(src => src.includes('discord'))).toBe(true);
    expect(srcs.some(src => src.includes('youtube'))).toBe(true);
  });

  it(`pins nothing more when a later slide links only platforms already met`, () => {
    setBinding('hallOfFame.common', 'settings', makeSettings({ showCreatorSocials: true }));
    setNextNeighbor([{ platform: 'discord', link: 'https://discord.test/x' }]);

    const { container } = render(<MenuControlsSocialsPreloader />);

    act(() => setNextNeighbor([{ platform: 'discord', link: 'https://discord.test/other' }]));
    act(() => setNextNeighbor(null));

    expect(preloadedSrcs(container)).toHaveLength(1);
  });

  it(`emits one node per logo when a creator links the same platform twice`, () => {
    setBinding('hallOfFame.common', 'settings', makeSettings({ showCreatorSocials: true }));
    setNextNeighbor([
      { platform: 'discord', link: 'https://discord.test/one' },
      { platform: 'discord', link: 'https://discord.test/two' }
    ]);

    const { container } = render(<MenuControlsSocialsPreloader />);

    expect(preloadedSrcs(container)).toHaveLength(1);
  });
});
