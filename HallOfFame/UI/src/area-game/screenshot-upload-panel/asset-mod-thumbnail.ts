/**
 * Matches a Paradox Mods cover URL, capturing everything up to its `.jpg` extension.
 */
const paradoxCoverUri =
  /^(?<cover>https:\/\/modscontent\.paradox-interactive\.com\/\S+\/covers\/cover_\d+)\.jpg$/u;

/**
 * Resolves the URI to display for a mod's thumbnail, pointing at the CDN's smallest variant.
 *
 * The engine hands the UI a full-size cover rather than a thumbnail: `Mod.thumbnailPath` is
 * assigned the Paradox Mods `ThumbnailUrl`, which runs to 2560px and a quarter of a megabyte for an
 * image drawn one line tall. Vanilla appends `?width=` to shrink it (`NotificationUISystem.width`),
 * but the CDN strips the query string ahead of both its cache lookup and Fastly's image optimizer,
 * so that has never done anything.
 *
 * What the CDN does serve is two derived siblings of every cover: `_square`, capping the long edge
 * at 600px, and `_thumb`, forcing every cover into 240x135 whatever shape it came in. `_thumb` is
 * the one taken here, at roughly a twentieth of the original's bytes against `_square`'s third,
 * which is worth the shape it forces: covers are square far more often than not, so the row undoes
 * the squash by painting the image to its own square box, and the 16:9 minority is what pays for
 * it.
 *
 * The convention is undocumented, appearing nowhere in the game's own code, so the rewrite stays
 * narrow: only an exact cover URL is touched and anything else passes through untouched, which
 * leaves a `_thumb` that ever stops existing degrading to the row's grey placeholder rather than
 * breaking the row.
 */
export function deriveModThumbnailUri(thumbnailPath: string): string {
  return thumbnailPath.replace(paradoxCoverUri, '$<cover>_thumb.jpg');
}
