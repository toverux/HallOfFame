import { useEffect, useState } from 'react';
import { preloadImage } from './preload-image';

/**
 * Whether the image at `url` is ready to show, for a reveal that waits for it:
 * a background image has no load event of its own,
 * so the image is fetched aside, through the engine's cache,
 * and reports ready once that fetch settles, failed or not.
 * Never ready while `url` is `null`.
 * Every mount waits for its own load: the engine's image cache is too small to hold a collection,
 * so an image out of the DOM is soon fetched again, and a remount shows it as it loads.
 *
 * @param preload Injectable preloader seam, which a test settles on command.
 */
export function useImageLoaded(
  url: string | null,
  preload: (url: string) => Promise<void> = preloadImage
): boolean {
  // The URL whose preload has settled.
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (url == null) {
      // So the same URL coming back waits for its load again.
      // oxlint-disable-next-line react/set-state-in-effect - clearing the gate is the effect's job
      setLoadedUrl(null);

      return;
    }

    let canceled = false;

    // A React effect callback must return its cleanup synchronously, so this preload runs as a
    // fire-and-forget chain rather than being awaited.
    // oxlint-disable-next-line promise/catch-or-return - see above
    preload(url)
      // oxlint-disable-next-line promise/prefer-await-to-then - see above
      .catch(() => {
        // A failed image is shown as it is, its box as blank as before.
      })
      // oxlint-disable-next-line promise/prefer-await-to-then - see above
      .finally(() => {
        if (!canceled) {
          setLoadedUrl(url);
        }
      });

    // oxlint-disable-next-line typescript/consistent-return - effect returns a cleanup fn or nothing (early exit)
    return () => {
      canceled = true;
    };
  }, [url, preload]);

  return url != null && loadedUrl == url;
}
