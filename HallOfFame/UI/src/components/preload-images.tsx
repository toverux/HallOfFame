import type { ReactElement } from 'react';
import * as styles from './preload-images.module.scss';

/**
 * Pins images in cohtml's cache, so they are ready the first time something actually shows them.
 * Referencing an image from a hidden node moves that fetch to mount time and keeps it there: the
 * image stays resident as long as this is mounted.
 */
export function PreloadImages({ srcs }: Readonly<{ srcs: readonly string[] }>): ReactElement {
  // noinspection HtmlRequiredAltAttribute
  return (
    <>
      {/* Deduplicated because the source is keying the node, and a caller computing its list from
          data (a creator with two links on one platform) cannot be asked to guarantee it. */}
      {[...new Set(srcs)].map(src => (
        <img key={src} src={src} className={styles.preload} />
      ))}
    </>
  );
}
