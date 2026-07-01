/**
 * @public
 * Preloads an image into Cohtml's image cache so it can later be displayed without a visible load.
 *
 * Resolves once the image's `onload` fires and rejects on `onerror`.
 * It also rejects after a safety timeout if neither fires: without this net, a load that never
 * settles (a stalled Cohtml fetch) would leave the splashscreen's readiness frozen and the
 * Next/Previous buttons disabled forever.
 *
 * Cohtml evicts images from its cache quickly, so an image must be preloaded before every display,
 * even one shown moments ago.
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();

    const timeout = setTimeout(() => {
      image.onload = null;
      image.onerror = null;

      reject(new Error(`Timed out preloading image after ${preloadTimeoutMs}ms: "${url}".`));
    }, preloadTimeoutMs);

    image.onload = () => {
      clearTimeout(timeout);

      resolve();
    };

    image.onerror = () => {
      clearTimeout(timeout);

      reject(new Error(`Failed to preload image: "${url}".`));
    };

    image.src = url;
  });
}

/**
 * Safety-net timeout for {@link preloadImage}.
 * Generous on purpose, so it never trips on a slow-but-legitimate load (e.g., a 4K variant on a
 * slow connection), only on one that will never settle.
 */
const preloadTimeoutMs = 30_000;
