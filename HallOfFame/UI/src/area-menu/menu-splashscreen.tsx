import classNames from 'classnames';
import { type CSSProperties, type ReactElement, useCallback, useEffect, useReducer } from 'react';
import { iconsole } from '../iconsole';
import { getClassesModule, selector } from '../utils';
import * as bindings from '../utils/bindings';
import * as styles from './menu-splashscreen.module.scss';
import { preloadImage as defaultPreloadImage } from './preload-image';

const coMenuUiBackdropsStyles = getClassesModule(
  'game-ui/menu/components/menu-ui-backdrops/menu-ui-backdrops.module.scss',
  ['backdropImage']
);

interface MenuSplashscreenProps {
  /**
   * Image-preloader seam.
   * Injectable so tests can drive `onload`/`onerror`/timeout deterministically; defaults to the
   * real Cohtml-backed {@link preloadImage}.
   */
  readonly preloadImage?: (url: string) => Promise<void>;
}

/**
 * Component that displays the splashscreen image on the main menu.
 *
 * ###### Implementation notes
 * The image transition is modeled as an explicit state machine (see {@link reducer}): a new image
 * URI is first preloaded into Cohtml's cache (the engine evicts images quickly, so a fresh preload
 * is needed before every display), then cross-faded in over the current image, then promoted to
 * the displayed image once the fade completes.
 * Modeling the in-flight load as state makes supersession (a newer URI arriving mid-load) and load
 * failure explicit, non-racy transitions.
 */
// biome-ignore lint/complexity/noExcessiveLinesPerFunction: cohesive machine driver; splitting the two effects out would scatter the transition logic and hurt readability.
export function MenuSplashscreen({
  preloadImage = defaultPreloadImage
}: MenuSplashscreenProps): ReactElement {
  const [{ imageUri, canAdvance }, setMenuState] = bindings.useSplashscreenState();

  // Seed from the current image (`imageUri`) when a screenshot is already published (e.g., a
  // remount after returning to the menu), so it shows immediately with no fade.
  // Otherwise, fall back to the image the Vanilla slideshow is still showing for a seamless
  // takeover when we are mounting after the Vanilla slideshow initialized (mod just installed or
  // late initialization).
  // And finally to the bundled OverlayBackground image of the game's main loading screen for when
  // the mod starts and the Vanilla slideshow was not shown at all.
  const [state, dispatch] = useReducer(reducer, imageUri, initState);

  // The UI is ready for the next image only when the slideshow can advance (no C# navigation or
  // preload in progress), no transition is in flight here, and we have settled on the current
  // `imageUri`.
  // Comparing `imageUri` against `requestedUrl` (not `displayedUrl`) closes the one-render gap
  // between `imageUri` changing and the driving effect starting its load, while still reporting
  // ready after a failed load: the user must be able to navigate away from an image that cannot be
  // loaded.
  const isReadyForNextImage =
    canAdvance &&
    state.phase.kind == 'displayed' &&
    (imageUri == null || imageUri == state.requestedUrl);

  useEffect(() => {
    setMenuState(prev => ({ ...prev, isReadyForNextImage }));
  }, [isReadyForNextImage]);

  // Drives the transition machine off `imageUri`: starts a preload when a new image is requested
  // and cancels an in-flight transition when `imageUri` returns to the displayed image mid-load
  // (e.g., the user navigates back to the current image).
  // Supersession is handled twice over: the `canceled` flag drops a stale resolution here, and the
  // reducer guards that only the actively preloading URL may start fading in.
  useEffect(() => {
    if (imageUri == null || imageUri == state.displayedUrl) {
      dispatch({ type: 'rest' });

      return;
    }

    let canceled = false;

    dispatch({ type: 'request', url: imageUri });

    preloadImage(imageUri)
      .then(() => {
        if (!canceled) {
          dispatch({ type: 'loaded', url: imageUri });
        }
      })
      .catch((error: unknown) => {
        if (canceled) {
          return;
        }

        // No retry and no user-facing surface by design: hold the current image and let readiness
        // unfreeze so the user can navigate elsewhere. C# already surfaces next/previous
        // fetch/preload failures through its own error overlay.
        iconsole.error(`HoF: Failed to preload splashscreen image "${imageUri}".`, error);

        dispatch({ type: 'failed', url: imageUri });
      });

    return () => {
      canceled = true;
    };
  }, [imageUri, state.displayedUrl, preloadImage]);

  // Promote the faded-in image to the displayed image once its fade-in animation completes.
  const handleFadeInEnd = useCallback((): void => {
    dispatch({ type: 'promote' });
  }, []);

  // Note: we use a <div> with a background image and not an <img>, because cohtml's engine does not
  // support `object-fit: cover`.
  return (
    <>
      <div
        // With [key], the incoming fade-in div below is recycled into this displayed div on
        // promotion (its DOM node, with the image already loaded, "becomes" this one), avoiding a
        // second fetch of the same image.
        key={state.displayedUrl}
        className={styles.splashscreen}
        style={backgroundImageStyle(state.displayedUrl)}
      />
      {state.phase.kind == 'fadingIn' && (
        <div
          key={state.phase.url}
          className={classNames(styles.splashscreen, styles.splashscreenFadeIn)}
          style={backgroundImageStyle(state.phase.url)}
          onAnimationEnd={handleFadeInEnd}
        />
      )}
    </>
  );
}

/**
 * Phase of the splashscreen transition machine.
 * `displayed` is the resting phase (showing {@link SplashscreenState.displayedUrl}); `preloading`
 * and `fadingIn` carry the URL of the image being transitioned in.
 */
type SplashscreenPhase =
  | { readonly kind: 'displayed' }
  | { readonly kind: 'preloading'; readonly url: string }
  | { readonly kind: 'fadingIn'; readonly url: string };

interface SplashscreenState {
  /**
   * Image currently painted as the base layer.
   * Never empty: the seed falls back to {@link fallbackBackgroundImage}, so the bare 3D environment
   * is never revealed.
   */
  readonly displayedUrl: string;

  readonly phase: SplashscreenPhase;

  /**
   * URI of the most recent image the machine has begun handling: the mount-time seed, or the target
   * of the latest preload (whether it is now loading, fading, displayed, or failed).
   * Readiness compares `imageUri` against this rather than {@link displayedUrl}; see the readiness
   * comment in {@link MenuSplashscreen}.
   */
  readonly requestedUrl: string | undefined;
}

type SplashscreenAction =
  | { readonly type: 'request'; readonly url: string }
  | { readonly type: 'loaded'; readonly url: string }
  | { readonly type: 'failed'; readonly url: string }
  | { readonly type: 'promote' }
  | { readonly type: 'rest' };

function reducer(state: SplashscreenState, action: SplashscreenAction): SplashscreenState {
  switch (action.type) {
    case 'request': {
      // Idempotent: a repeat request for the URL already in flight is a no-op.
      if (isTransitioningTo(state.phase, action.url)) {
        return state;
      }

      return {
        ...state,
        phase: { kind: 'preloading', url: action.url },
        requestedUrl: action.url
      };
    }

    case 'loaded': {
      // Supersession guard: only the URL we are actively preloading may start fading in.
      if (state.phase.kind != 'preloading' || state.phase.url != action.url) {
        return state;
      }

      return { ...state, phase: { kind: 'fadingIn', url: action.url } };
    }

    case 'failed': {
      // Only the in-flight preload may fail us back to rest; hold the displayed image and keep
      // `requestedUrl` as the failed URL so readiness unfreezes.
      if (state.phase.kind != 'preloading' || state.phase.url != action.url) {
        return state;
      }

      return { ...state, phase: { kind: 'displayed' } };
    }

    case 'promote': {
      if (state.phase.kind != 'fadingIn') {
        return state;
      }

      return {
        displayedUrl: state.phase.url,
        phase: { kind: 'displayed' },
        requestedUrl: state.phase.url
      };
    }

    case 'rest': {
      // The wanted image is already displayed: cancel any in-flight transition.
      if (state.phase.kind == 'displayed') {
        return state;
      }

      return { ...state, phase: { kind: 'displayed' }, requestedUrl: state.displayedUrl };
    }

    default:
      throw action satisfies never;
  }
}

/**
 * Lazy {@link useReducer} initializer; see the seed comment in {@link MenuSplashscreen}.
 * `getCurrentSlideshowImageSrc` runs only when no screenshot is published yet, so its
 * `querySelector` happens at most once and never on a re-render.
 */
function initState(seedImageUri: string | null): SplashscreenState {
  return {
    displayedUrl: seedImageUri ?? getCurrentSlideshowImageSrc() ?? fallbackBackgroundImage,
    phase: { kind: 'displayed' },
    requestedUrl: seedImageUri ?? undefined
  };
}

function isTransitioningTo(phase: SplashscreenPhase, url: string): boolean {
  return (phase.kind == 'preloading' || phase.kind == 'fadingIn') && phase.url == url;
}

function backgroundImageStyle(url: string): CSSProperties {
  return { backgroundImage: `url(${url})` };
}

/**
 * Called once when initializing the mod's menu UI, at this time the Vanilla backdrop image element
 * may still be present if the mod was just installed or when mods initialize late.
 * It is destroyed by our module override but will only disappear on the next render cycle.
 * So we retrieve the image currently shown by the Vanilla slideshow to ensure a smooth transition
 * between Vanilla and the mod backgrounds.
 */
function getCurrentSlideshowImageSrc(): string | null {
  const backdropImageEl = document.querySelector(selector(coMenuUiBackdropsStyles.backdropImage));

  // The vanilla slideshow never mounted, we are first.
  if (!(backdropImageEl instanceof HTMLElement)) {
    return null;
  }

  // Here too, we shouldn't get a null result but again, fail gracefully.
  const backgroundImage =
    backdropImageEl.style.backgroundImage
      // biome-ignore lint/performance/useTopLevelRegex: called only once
      ?.match(/^url\(["']?(.*?)["']?\)$/)?.[1] || null;

  if (!backgroundImage) {
    iconsole.error(`HoF: Failed to retrieve the background image from the Vanilla slideshow.`);
  }

  return backgroundImage;
}

// Cold-boot background, used only when there is no published screenshot yet, nor a Vanilla
// slideshow image to seed from.
const fallbackBackgroundImage = 'Media/Menu/OverlayBackground.png';
