import { trigger, useValue } from 'cs2/api';
import { lazyBindValue } from './lazy-value-binding';

const GROUP = 'hallOfFame.capture';

/**
 * @public
 * From `Colossal.PSI.Common.Mod`
 */
export interface JsonMod {
  readonly id: string;
  readonly displayName: string;
  readonly thumbnailPath: string;
}

/**
 * @public
 * From `HallOfFame.Services.ScreenshotSnapshot`
 */
export interface JsonScreenshotSnapshot {
  readonly achievedMilestone: number;
  readonly population: number;
  readonly previewImageUri: string;
  readonly imageUri: string;
  readonly imageFileSize: number;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly wasGlobalIlluminationDisabled: boolean;
  readonly areSettingsTopQuality: boolean;
}

/**
 * @public
 * From `HallOfFame.Services.UploadProgress`
 */
export interface JsonUploadProgress {
  readonly isComplete: boolean;
  readonly globalProgress: number;
  readonly uploadProgress: number;
  readonly processingProgress: number;
}

/**
 * @public
 * From `HallOfFame.Services.UploadFormMemory`
 */
export interface JsonUploadFormMemory {
  readonly shareModIds: boolean;
  readonly shareRenderSettings: boolean;
  readonly description: string | null;
}

/**
 * @public
 * Argument of the {@link uploadScreenshot} command, mapped on the UI side from the upload form
 * state into the shape the C# `uploadScreenshot` command expects.
 */
export interface UploadPayload {
  readonly shareModIds: boolean;
  readonly shareRenderSettings: boolean;
  readonly showcasedModId: string | null;
  readonly description: string | null;
}

const assetMods$ = lazyBindValue<JsonMod[]>(GROUP, 'assetMods');

const cityName$ = lazyBindValue<string>(GROUP, 'cityName');

const screenshotSnapshot$ = lazyBindValue<JsonScreenshotSnapshot | null>(
  GROUP,
  'screenshotSnapshot',
  null
);

const uploadProgress$ = lazyBindValue<JsonUploadProgress | null>(GROUP, 'uploadProgress', null);

const uploadFormMemory$ = lazyBindValue<JsonUploadFormMemory>(GROUP, 'uploadFormMemory', {
  shareModIds: true,
  shareRenderSettings: true,
  description: null
});

export function useAssetMods(): JsonMod[] {
  return useValue(assetMods$());
}

export function useCityName(): string {
  return useValue(cityName$());
}

export function useScreenshotSnapshot(): JsonScreenshotSnapshot | null {
  return useValue(screenshotSnapshot$());
}

export function useUploadProgress(): JsonUploadProgress | null {
  return useValue(uploadProgress$());
}

export function useUploadFormMemory(): JsonUploadFormMemory {
  return useValue(uploadFormMemory$());
}

export function takeScreenshot(): void {
  trigger(GROUP, 'takeScreenshot');
}

export function clearScreenshot(): void {
  trigger(GROUP, 'clearScreenshot');
}

export function uploadScreenshot(payload: UploadPayload): void {
  trigger(GROUP, 'uploadScreenshot', payload);
}
