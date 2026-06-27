import type { JsonMod, UploadPayload } from '../../bindings';

/**
 * UI-side state of the screenshot upload form.
 * Shared by the panel orchestrator (which owns it), the info form (which edits it), and the footer
 * (which submits it via {@link buildUploadPayload}).
 */
export interface ScreenshotInfoFormValue {
  shareModIds: boolean;
  shareRenderSettings: boolean;
  isShowcasingAsset: boolean;
  showcasedMod: JsonMod | undefined;
  description: string;
}

/**
 * Validates the form state and maps it to the {@link UploadPayload} the capture facade expects.
 * Returns `undefined` when the user opted to showcase an asset but did not pick one, signaling the
 * caller that there is nothing to submit yet.
 */
export function buildUploadPayload(formValue: ScreenshotInfoFormValue): UploadPayload | undefined {
  if (formValue.isShowcasingAsset && !formValue.showcasedMod) {
    return undefined;
  }

  return {
    shareModIds: formValue.shareModIds,
    shareRenderSettings: formValue.shareRenderSettings,
    showcasedModId:
      formValue.isShowcasingAsset && formValue.showcasedMod ? formValue.showcasedMod.id : null,
    description: formValue.description.trim() || null
  };
}
