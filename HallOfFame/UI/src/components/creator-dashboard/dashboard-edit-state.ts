import type { Mod, Screenshot } from '../../common';
import type { JsonMod, ScreenshotUpdate } from '../../utils/bindings';

/**
 * The edit form's fields, as the creator types them.
 */
export interface EditFormValue {
  readonly cityName: string;
  readonly description: string;
  readonly isShowcasingAsset: boolean;
  readonly showcasedMod: JsonMod | undefined;
  readonly shareParadoxModIds: boolean;
  readonly shareRenderSettings: boolean;
}

/**
 * The form as the screenshot stands, the showcased mod in the picker's shape.
 */
export function initialEditForm(screenshot: Screenshot): EditFormValue {
  const showcasedMod = screenshot.showcasedMod && toJsonMod(screenshot.showcasedMod);

  return {
    cityName: screenshot.cityName,
    description: screenshot.description,
    isShowcasingAsset: showcasedMod != null,
    showcasedMod,
    shareParadoxModIds: screenshot.shareParadoxModIds,
    shareRenderSettings: screenshot.shareRenderSettings
  };
}

/**
 * The fields of the form that differ from the screenshot, trimmed as the server trims them,
 * so a field changed and changed back is not sent.
 * Unchecking the showcased asset clears the showcased mod.
 */
export function buildScreenshotUpdate(
  form: EditFormValue,
  screenshot: Screenshot
): ScreenshotUpdate {
  const cityName = form.cityName.trim();
  const description = form.description.trim();

  const showcasedModId = form.isShowcasingAsset ? (form.showcasedMod?.id ?? '') : '';
  const heldShowcasedModId = screenshot.showcasedMod
    ? String(screenshot.showcasedMod.paradoxModId)
    : '';

  return {
    ...(cityName != screenshot.cityName && { cityName }),
    ...(description != screenshot.description && { description }),
    ...(showcasedModId != heldShowcasedModId && { showcasedModId }),
    ...(form.shareParadoxModIds != screenshot.shareParadoxModIds && {
      shareParadoxModIds: form.shareParadoxModIds
    }),
    ...(form.shareRenderSettings != screenshot.shareRenderSettings && {
      shareRenderSettings: form.shareRenderSettings
    })
  };
}

/**
 * Whether Save has something to send.
 * The server checks the values: the form only holds the save while a showcased asset is checked
 * without a pick, which the picker flags, so the creator picks one or unchecks it.
 */
export function canSaveEditForm(form: EditFormValue, screenshot: Screenshot): boolean {
  return (
    !(form.isShowcasingAsset && !form.showcasedMod) &&
    Object.keys(buildScreenshotUpdate(form, screenshot)).length > 0
  );
}

/**
 * The mods the picker offers: the playset's asset mods, and the one showcased now when the
 * playset lacks it or could not be read, first so it is found where the form opened on it.
 */
export function selectPickableMods(
  assetMods: readonly JsonMod[],
  showcasedMod?: Mod
): readonly JsonMod[] {
  const showcased = showcasedMod && toJsonMod(showcasedMod);

  return showcased && !assetMods.some(mod => mod.id == showcased.id)
    ? [showcased, ...assetMods]
    : assetMods;
}

/**
 * The showcased mod in the playset's wire shape, its ID the Paradox Mods one, so the picker and
 * the update take it like a playset mod.
 */
function toJsonMod(mod: Mod): JsonMod {
  return {
    id: String(mod.paradoxModId),
    displayName: mod.name,
    author: mod.authorName,
    thumbnailPath: mod.thumbnailUrl
  };
}
