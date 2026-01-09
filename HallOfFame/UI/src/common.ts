export const supportedSocialPlatforms = ['paradoxmods', 'discord', 'youtube', 'twitch'] as const;

/** Serialization of C# `HallOfFame.Domain.Creator` */
export interface Creator {
  readonly id: string;
  readonly creatorName: string;
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
  readonly mapName: string | null;
  readonly description: string | null;
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
  readonly creator: Creator;
  readonly showcasedMod?: Mod;
}

/** Serialization of C# `HallOfFame.Domain.Mod` */
interface Mod {
  readonly id: string;
  readonly name: string;
  readonly authorName: string;
  readonly shortDescription: string;
  readonly thumbnailUrl: string;
  readonly subscribersCount: number;
}
