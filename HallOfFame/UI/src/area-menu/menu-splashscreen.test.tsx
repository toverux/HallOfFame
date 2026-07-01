// biome-ignore-all lint/style/useComponentExportOnlyModules: test module; components are local render fixtures beside helpers, and Fast Refresh does not apply to tests.

import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ModuleRegistry, ModuleRegistryExtend } from 'cs2/modding';
import type { ReactElement } from 'react';
import type { Screenshot } from '../common';
import { iconsole } from '../iconsole';
import { createFakePreloader, makeScreenshot, makeSettings } from '../testing/fixtures';
import { resetBindings, setBinding } from '../testing/game-setup';
import { getClassesModule } from '../utils';
import * as bindings from '../utils/bindings';
import { register } from './index';
import { MenuSplashscreen } from './menu-splashscreen';

const SLIDESHOW = 'hallOfFame.slideshow';
const COMMON = 'hallOfFame.common';

// The real (bundle-resolved) class of the Vanilla menu backdrop image, used to plant a fake
// Vanilla element the mount-time seed can read.
const vanillaBackdropClass = getClassesModule(
  'game-ui/menu/components/menu-ui-backdrops/menu-ui-backdrops.module.scss',
  ['backdropImage']
).backdropImage;

afterEach(() => {
  cleanup();
  resetBindings();

  // Remove any planted Vanilla backdrop so it cannot leak into the next test's seed.
  for (const element of document.querySelectorAll(`.${vanillaBackdropClass}`)) {
    element.remove();
  }
});

// biome-ignore lint/complexity/noExcessiveLinesPerFunction: comprehensive matrix; one `describe` per concern reads better than splitting it up.
describe('MenuSplashscreen transition machine', () => {
  it(`seeds from the Vanilla image on cold boot and shows it with no fade`, () => {
    plantVanillaBackdrop('vanilla.png');

    const { container } = renderSplashscreen();

    const divs = splashscreenDivs(container);

    expect(divs).toHaveLength(1);
    expect(backgroundOf(divs[0])).toContain('vanilla.png');
  });

  it(`falls back to the bundled OverlayBackground image when there is nothing to seed from`, () => {
    const { container } = renderSplashscreen();

    const divs = splashscreenDivs(container);

    expect(divs).toHaveLength(1);
    // No screenshot and no Vanilla image: the bundled fallback image is shown (the SCSS background
    // color still covers it until it loads).
    expect(backgroundOf(divs[0])).toContain('OverlayBackground.png');
  });

  it(`shows an already-published screenshot immediately, with no fade and no preload`, () => {
    setScreenshot(makeScreenshot({ imageUrlFHD: 'published.png' }));

    const fake = createFakePreloader();
    const { container } = renderSplashscreen(fake);

    const divs = splashscreenDivs(container);

    expect(divs).toHaveLength(1);
    expect(backgroundOf(divs[0])).toContain('published.png');
    expect(fake.calls).toHaveLength(0);
    expect(readiness()).toBe('ready');
  });

  it(`preloads, fades in, then promotes a newly-requested image`, async () => {
    setScreenshot(makeScreenshot({ imageUrlFHD: 'a.png' }));

    const fake = createFakePreloader();
    const { container } = renderSplashscreen(fake);

    // Request B: a preload starts, the old image holds, and readiness freezes.
    act(() => setScreenshot(makeScreenshot({ imageUrlFHD: 'b.png' })));

    expect(fake.calls.map(call => call.url)).toEqual(['b.png']);
    expect(splashscreenDivs(container)).toHaveLength(1);
    expect(backgroundOf(splashscreenDivs(container)[0])).toContain('a.png');
    expect(readiness()).toBe('busy');

    // B finishes preloading: it fades in over A while still reporting not-ready.
    await act(async () => fake.resolveLast('b.png'));

    const fading = splashscreenDivs(container);

    expect(fading).toHaveLength(2);
    expect(backgroundOf(fading[0])).toContain('a.png');
    expect(backgroundOf(fading[1])).toContain('b.png');
    expect(readiness()).toBe('busy');

    // The fade ends: B is promoted to the displayed image and readiness unfreezes.
    fireEvent.animationEnd(fadeDiv(container));

    const promoted = splashscreenDivs(container);

    expect(promoted).toHaveLength(1);
    expect(backgroundOf(promoted[0])).toContain('b.png');
    expect(readiness()).toBe('ready');
  });

  it(`ignores a superseded load so only the latest requested image fades in`, async () => {
    setScreenshot(makeScreenshot({ imageUrlFHD: 'x.png' }));

    const fake = createFakePreloader();
    const { container } = renderSplashscreen(fake);

    act(() => setScreenshot(makeScreenshot({ imageUrlFHD: 'a.png' })));
    act(() => setScreenshot(makeScreenshot({ imageUrlFHD: 'b.png' })));

    expect(fake.calls.map(call => call.url)).toEqual(['a.png', 'b.png']);

    // A (superseded) resolves late: it must not fade in.
    await act(async () => fake.resolveLast('a.png'));

    expect(splashscreenDivs(container)).toHaveLength(1);
    expect(readiness()).toBe('busy');

    // B (latest) resolves: only B fades in.
    await act(async () => fake.resolveLast('b.png'));

    const fading = splashscreenDivs(container);

    expect(fading).toHaveLength(2);
    expect(backgroundOf(fading[1])).toContain('b.png');

    fireEvent.animationEnd(fadeDiv(container));

    expect(backgroundOf(splashscreenDivs(container)[0])).toContain('b.png');
  });

  it(`holds the old image and reports not-ready during a slow resolution-change load`, async () => {
    setBinding(COMMON, 'settings', makeSettings({ screenshotResolution: 'fhd' }));
    setScreenshot(makeScreenshot({ imageUrlFHD: 'fhd.png', imageUrl4K: '4k.png' }));

    const fake = createFakePreloader();
    const { container } = renderSplashscreen(fake);

    // Toggle the resolution: the 4K variant is not in cache, so a real UI-side load starts.
    act(() => setBinding(COMMON, 'settings', makeSettings({ screenshotResolution: '4k' })));

    expect(fake.calls.map(call => call.url)).toEqual(['4k.png']);
    expect(splashscreenDivs(container)).toHaveLength(1);
    expect(backgroundOf(splashscreenDivs(container)[0])).toContain('fhd.png');
    expect(readiness()).toBe('busy');

    await act(async () => fake.resolveLast('4k.png'));

    fireEvent.animationEnd(fadeDiv(container));

    expect(backgroundOf(splashscreenDivs(container)[0])).toContain('4k.png');
    expect(readiness()).toBe('ready');
  });

  it(`holds the current image, warns, and unfreezes readiness on a preload error`, async () => {
    const errorSpy = spyOn(iconsole, 'error').mockImplementation(() => undefined);

    setScreenshot(makeScreenshot({ imageUrlFHD: 'a.png' }));

    const fake = createFakePreloader();
    const { container } = renderSplashscreen(fake);

    act(() => setScreenshot(makeScreenshot({ imageUrlFHD: 'bad.png' })));

    expect(readiness()).toBe('busy');

    await act(async () => fake.rejectLast('bad.png', new Error('boom')));

    const divs = splashscreenDivs(container);

    // No fade, the old image holds, and readiness unfreezes so the user can navigate away.
    expect(divs).toHaveLength(1);
    expect(backgroundOf(divs[0])).toContain('a.png');
    expect(readiness()).toBe('ready');

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(String(errorSpy.mock.calls[0]?.[0])).toContain('HoF:');

    errorSpy.mockRestore();
  });

  it(`recovers from a preload timeout exactly like an error`, async () => {
    const errorSpy = spyOn(iconsole, 'error').mockImplementation(() => undefined);

    setScreenshot(makeScreenshot({ imageUrlFHD: 'a.png' }));

    const fake = createFakePreloader();
    const { container } = renderSplashscreen(fake);

    act(() => setScreenshot(makeScreenshot({ imageUrlFHD: 'stalled.png' })));

    // The real preloadImage rejects on its 30s timeout; here the seam rejects on command, which the
    // machine handles identically to an error.
    await act(async () => fake.rejectLast('stalled.png', new Error('Timed out preloading image')));

    const divs = splashscreenDivs(container);

    expect(divs).toHaveLength(1);
    expect(backgroundOf(divs[0])).toContain('a.png');
    expect(readiness()).toBe('ready');
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });

  it(`reports not-ready when the slideshow cannot advance, even while resting`, () => {
    setBinding(SLIDESHOW, 'canAdvance', false);
    setScreenshot(makeScreenshot({ imageUrlFHD: 'a.png' }));

    renderSplashscreen();

    // Resting on a displayed image, but C# says it cannot advance yet.
    expect(readiness()).toBe('busy');

    act(() => setBinding(SLIDESHOW, 'canAdvance', true));

    expect(readiness()).toBe('ready');
  });
});

describe(`menu backdrop gating (area-menu/index)`, () => {
  it(`hides the Vanilla backdrop when the slideshow is enabled`, () => {
    const MenuUIBackdrops = captureExtension('MenuUIBackdrops')(VanillaBackdrops);

    setBinding(SLIDESHOW, 'enableMainMenuSlideshow', true);
    render(<MenuUIBackdrops />);

    expect(screen.queryByTestId('vanilla-backdrops')).toBeNull();
  });

  it(`renders the Vanilla backdrop when the slideshow is disabled`, () => {
    const MenuUIBackdrops = captureExtension('MenuUIBackdrops')(VanillaBackdrops);

    setBinding(SLIDESHOW, 'enableMainMenuSlideshow', false);
    render(<MenuUIBackdrops />);

    expect(screen.queryByTestId('vanilla-backdrops')).not.toBeNull();
  });

  it(`mounts the splashscreen alongside the menu only when the slideshow is enabled`, () => {
    const MenuUI = captureExtension('MenuUI')(VanillaMenu);

    setBinding(SLIDESHOW, 'enableMainMenuSlideshow', true);
    const { container: enabled } = render(<MenuUI />);

    expect(screen.queryByTestId('vanilla-menu')).not.toBeNull();
    // The splashscreen renders its own div with no test id alongside the menu.
    expect(enabled.querySelectorAll('div:not([data-testid])')).toHaveLength(1);

    cleanup();

    setBinding(SLIDESHOW, 'enableMainMenuSlideshow', false);
    const { container: disabled } = render(<MenuUI />);

    expect(screen.queryByTestId('vanilla-menu')).not.toBeNull();
    expect(disabled.querySelectorAll('div:not([data-testid])')).toHaveLength(0);
  });
});

/**
 * Renders the splashscreen next to a readiness probe.
 * The probe is rendered first, so its singleton listener is registered before the splashscreen's
 * mount effect reports the initial readiness, so the probe never misses that first update.
 */
function renderSplashscreen(fake = createFakePreloader()): { container: HTMLElement } {
  return render(
    <>
      <ReadinessProbe />
      <MenuSplashscreen preloadImage={fake.preload} />
    </>
  );
}

function ReadinessProbe(): ReactElement {
  const [{ isReadyForNextImage }] = bindings.useHofMenuState();

  return <span data-testid='ready'>{isReadyForNextImage ? 'ready' : 'busy'}</span>;
}

function readiness(): string {
  return screen.getByTestId('ready').textContent ?? '';
}

function splashscreenDivs(container: HTMLElement): readonly HTMLElement[] {
  return [...container.querySelectorAll('div')];
}

/** The incoming fade-in div (the second splashscreen div), present only while fading. */
function fadeDiv(container: HTMLElement): HTMLElement {
  const [, div] = splashscreenDivs(container);

  if (!div) {
    throw new Error(`Expected a fade-in div but the splashscreen is not fading.`);
  }

  return div;
}

function backgroundOf(element: HTMLElement | undefined): string {
  return element?.style.backgroundImage ?? '';
}

function setScreenshot(screenshot: Screenshot): void {
  setBinding(SLIDESHOW, 'screenshot', screenshot);
}

function plantVanillaBackdrop(url: string): void {
  const element = document.createElement('div');

  element.className = vanillaBackdropClass;
  element.style.backgroundImage = `url(${url})`;

  document.body.append(element);
}

/** Runs the mod's `register` against a fake registry and returns the named extension's enhancer. */
function captureExtension(exportName: string): ModuleRegistryExtend {
  const extensions = new Map<string, ModuleRegistryExtend>();

  const fakeRegistry = {
    extend(_modulePath: string, name: string, extendCb?: ModuleRegistryExtend): void {
      if (extendCb) {
        extensions.set(name, extendCb);
      }
    }
  };

  register(fakeRegistry as unknown as ModuleRegistry);

  const enhancer = extensions.get(exportName);

  if (!enhancer) {
    throw new Error(`No extension registered for "${exportName}".`);
  }

  return enhancer;
}

function VanillaBackdrops(): ReactElement {
  return <div data-testid='vanilla-backdrops' />;
}

function VanillaMenu(): ReactElement {
  return <div data-testid='vanilla-menu' />;
}
