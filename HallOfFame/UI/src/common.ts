/**
 * These interfaces mirror the outbound UI wire format emitted by the C#
 * `Utils/Writers/*ValueWriter` classes, not the `Domain/*` records directly: decode uses the
 * server's vocabulary while the writers use the mod/UI vocabulary.
 * C# is canonical; when a writer changes a field's shape or nullability, update the matching
 * interface here.
 */

export const supportedSocialPlatforms = ['paradoxmods', 'discord', 'youtube', 'twitch'] as const;

/** Serialization of C# `HallOfFame.Domain.Creator` */
export interface Creator {
  readonly id: string;
  // `null` for anonymous creators.
  readonly creatorName: string | null;
  readonly creatorNameLocale: string | null;
  readonly creatorNameLatinized: string | null;
  readonly creatorNameTranslated: string | null;
  readonly socials: readonly CreatorSocialLink[];
}

/** Serialization of C# `HallOfFame.Domain.Creator.CreatorSocialLink` */
export interface CreatorSocialLink {
  readonly platform: (typeof supportedSocialPlatforms)[number];
  readonly link: string;
}

/** Serialization of C# `HallOfFame.Domain.Screenshot` */
export interface Screenshot {
  readonly id: string;
  readonly cityName: string;
  readonly cityNameLocale: string | null;
  readonly cityNameLatinized: string | null;
  readonly cityNameTranslated: string | null;
  readonly cityMilestone: number;
  readonly cityPopulation: number;
  readonly mapName: string;
  readonly description: string;
  readonly imageUrlFHD: string;
  readonly imageUrl4K: string;
  readonly shareRenderSettings: boolean;
  readonly renderSettings: Readonly<Record<string, string>>;
  readonly createdAt: string;
  readonly createdAtFormatted: string;
  readonly createdAtFormattedDistance: string;
  readonly likesCount: number;
  readonly viewsCount: number;
  readonly uniqueViewsCount: number;
  readonly likingPercentage: number;
  readonly isLiked: boolean;
  // Always present for the endpoints the mod calls. The server omits it only on PUT/DELETE
  // /screenshots, which the mod does not call; if that changes, make this optional and guard the
  // consumers (e.g., city-name.tsx) against an absent creator.
  readonly creator: Creator;
  readonly showcasedMod?: Mod;
}

/** Serialization of C# `HallOfFame.Domain.Mod` */
export interface Mod {
  readonly id: string;
  readonly paradoxModId: number;
  readonly name: string;
  readonly authorName: string;
  readonly shortDescription: string;
  readonly thumbnailUrl: string;
  readonly subscribersCount: number;
  readonly tags: readonly string[];
}
