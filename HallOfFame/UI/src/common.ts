export interface Creator {
  readonly id: string;

  readonly creatorName: string;

  readonly creatorNameLocale: string | null;

  readonly creatorNameLatinized: string | null;

  readonly creatorNameTranslated: string | null;

  readonly social: readonly CreatorSocialLink[];
}

export interface CreatorSocialLink {
  readonly platform: 'discordServer' | 'paradoxMods' | 'reddit' | 'twitch' | 'youtube';

  readonly description: string;

  readonly link: string;

  /** Only for Paradox Mods, Reddit. */
  readonly username: string | null;
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

  readonly favoritesCount: number;

  readonly favoritesPerDay: number;

  readonly viewsCount: number;

  readonly viewsPerDay: number;

  readonly isFavorite: boolean;

  readonly creator?: Creator | undefined;
}
