import { type ReactElement, useEffect, useState } from 'react';
import { supportedSocialPlatforms } from '../../common';
import { PreloadImages } from '../../components/preload-images';
import * as bindings from '../../utils/bindings';
import { socialPlatforms } from './social-platforms';

/**
 * Preloads the social logos the slideshow has run into, rather than every supported platform's.
 *
 * The set only grows, for the whole time this is mounted. Dropping a logo once its slide has passed
 * would fetch it again on the way back, and again on the next creator using the same platform.
 */
export function MenuControlsSocialsPreloader(): ReactElement {
  const modSettings = bindings.useModSettings();

  const nextScreenshot = bindings.useNextNeighbor();

  // A set rather than a list: what is held is the platforms met so far, and a creator may well link
  // one of them twice.
  const [logos, setLogos] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const upcoming = nextScreenshot?.creator.socials
      .filter(link => supportedSocialPlatforms.includes(link.platform))
      .map(link => socialPlatforms[link.platform].logo);

    if (!upcoming?.length) {
      return;
    }

    // Returning the previous set when the slide brings nothing new skips the state update, and
    // with it the render, on the many slides that add no platform.
    setLogos(prev =>
      upcoming.every(logo => prev.has(logo)) ? prev : new Set([...prev, ...upcoming])
    );
  }, [nextScreenshot]);

  // Accumulated even while the setting is off, that being free, but pinned only while it is on:
  // there is nothing to have ready for a row of icons the player has hidden.
  return <PreloadImages srcs={modSettings.showCreatorSocials ? [...logos] : []} />;
}
