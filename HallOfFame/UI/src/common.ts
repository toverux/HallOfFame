export interface Creator {
    readonly id: string;
    readonly creatorName: string;
}

export interface Screenshot {
    readonly id: string;
    readonly cityName: string;
    readonly cityMilestone: number;
    readonly cityPopulation: number;
    readonly imageUrlFHD: string;
    readonly imageUrl4K: string;
    readonly createdAt: string;
    readonly createdAtFormatted: string;
    readonly createdAtFormattedDistance: string;
    readonly favoritesCount: number;
    readonly isFavorite: boolean;
    readonly creator?: Creator | undefined;
}
