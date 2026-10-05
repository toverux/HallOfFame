/**
 * These interfaces mirror the outbound UI wire format emitted by the C#
 * `Utils/Writers/*ValueWriter` classes, not the `Domain/*` records directly: decode uses the
 * server's vocabulary while the writers use the mod/UI vocabulary.
 * C# is canonical; when a writer changes a field's shape or nullability, update the matching
 * interface here.
 */

export const supportedSocialPlatforms = ['paradoxmods', 'discord', 'youtube', 'twitch'] as const;

/**
 * Serialization of C# `HallOfFame.Domain.Creator`
 */
export interface Creator {
  readonly id: string;
  // `null` for anonymous creators.
  readonly creatorName: string | null;
  readonly creatorNameLocale: string | null;
  readonly creatorNameLatinized: string | null;
  readonly creatorNameTranslated: string | null;
  // Tracked redirect to this creator's viewer page: it counts the click, then redirects.
  readonly viewerUrl: string;
  // The viewer page itself, untracked. This is the link to hand to a human.
  readonly viewerShareUrl: string;
  readonly socials: readonly CreatorSocialLink[];
}

/**
 * Serialization of C# `HallOfFame.Domain.Creator.CreatorSocialLink`
 */
export interface CreatorSocialLink {
  readonly platform: (typeof supportedSocialPlatforms)[number];
  readonly link: string;
}

/**
 * Serialization of C# `HallOfFame.Domain.Screenshot`
 */
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
  // Tracked redirect to this screenshot's viewer page: it counts the click, then redirects.
  readonly viewerUrl: string;
  // The viewer page itself, untracked. This is the link to hand to a human.
  readonly viewerShareUrl: string;
  // The playset's Paradox Mods IDs, empty when the creator did not share it or it has none.
  readonly paradoxModIds: readonly number[];
  readonly shareRenderSettings: boolean;
  readonly renderSettings: Readonly<Record<string, string>>;
  // The scene and light the shot was taken in, by name, each value keeping its type. The mod adds
  // names over its releases: read one by name, ignoring the rest.
  readonly renderConditions: Readonly<Record<string, RenderConditionValue>>;
  // A field missing from it holds a default: the screenshot predates the mod release capturing it.
  readonly capabilities: readonly ScreenshotCapability[];
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

export type RenderConditionValue = number | string | boolean;

/**
 * A server field of a screenshot holding what the uploading mod captured.
 */
export type ScreenshotCapability =
  | 'description'
  | 'shareParadoxModIds'
  | 'paradoxModIds'
  | 'shareRenderSettings'
  | 'renderSettings'
  | 'renderConditions';

/**
 * Serialization of C# `HallOfFame.Systems.PhotoModeCatalogEntry`: one property of the game's photo
 * mode, the catalog listing them in the game's order.
 * A color or a vector has one entry per component, its code ending with the component's suffix
 * (`/r`, `/x`...).
 */
export interface PhotoModeProperty {
  readonly code: string;
  // The photo mode tab holding the property.
  readonly group: string;
  // The section title the property sits under in its tab, `null` when it precedes any title.
  readonly section: string | null;
  readonly kind: 'number' | 'enum' | 'checkbox' | 'colorComponent' | 'vectorComponent';
  // For numbers and vector components.
  readonly fractionDigits: number;
  // For enums, the enum's type name, as the game's option localization keys use it.
  readonly enumType: string | null;
  readonly enumOptions: readonly PhotoModeEnumOption[];
}

export interface PhotoModeEnumOption {
  readonly name: string;
  readonly value: number;
}

/**
 * Serialization of C# `HallOfFame.Domain.Mod`
 */
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
