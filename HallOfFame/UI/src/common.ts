export const supportedSocialPlatforms = [
  'citiescollective',
  'paradoxmods',
  'discord',
  'youtube',
  'twitch'
] as const;

export interface Creator {
  readonly id: string;

  readonly creatorName: string;

  readonly creatorNameLocale: string | null;

  readonly creatorNameLatinized: string | null;

  readonly creatorNameTranslated: string | null;

  readonly socials: readonly CreatorSocialLink[];
}

export interface CreatorSocialLink {
  readonly platform: (typeof supportedSocialPlatforms)[number];

  readonly link: string;
}

export interface Screenshot {
  readonly id: string;

  readonly cityName: string;

  readonly cityNameLocale: string | null;

  readonly cityNameLatinized: string | null;

  readonly cityNameTranslated: string | null;

  readonly cityMilestone: number;

  readonly cityPopulation: number;

  readonly imageUrlFHD: string;

  readonly imageUrl4K: string;

  readonly createdAt: string;

  readonly createdAtFormatted: string;

  readonly createdAtFormattedDistance: string;

  readonly likesCount: number;

  readonly viewsCount: number;

  readonly likingPercentage: number;

  readonly isLiked: boolean;

  readonly citiesCollectiveUrl: string | null;

  readonly creator?: Creator | undefined;
}
