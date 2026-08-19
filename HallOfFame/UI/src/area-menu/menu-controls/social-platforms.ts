import type { CreatorSocialLink } from '../../common';
import discordBrandsSolid from '../../icons/fontawesome/discord-brands-solid.svg';
import twitchBrandsSolid from '../../icons/fontawesome/twitch-brands-solid.svg';
import youtubeBrandsSolid from '../../icons/fontawesome/youtube-brands-solid.svg';

/**
 * How each platform the mod supports is presented: the name shown in a tooltip, the logo, and the
 * brand color the button takes on hover.
 *
 * It sits apart from both the row that renders it and the preloader that pins its logos, so neither
 * has to import the other for it.
 */
export const socialPlatforms: Record<
  CreatorSocialLink['platform'],
  Readonly<{ name: string; logo: string; color: string }>
> = {
  discord: { name: 'Discord', logo: discordBrandsSolid, color: '#5865F2' },
  paradoxmods: { name: 'Paradox Mods', logo: 'Media/Glyphs/ParadoxMods.svg', color: '#5abe41' },
  twitch: { name: 'Twitch', logo: twitchBrandsSolid, color: '#8956FB' },
  youtube: { name: 'YouTube', logo: youtubeBrandsSolid, color: '#FF0000' }
};
