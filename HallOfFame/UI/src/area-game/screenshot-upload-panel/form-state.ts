import type { JsonMod } from '../../bindings';

/**
 * UI-side state of the screenshot upload form.
 * Shared by the panel orchestrator (which owns it), the info form (which edits it), and the footer
 * (which submits it via {@link submitUpload}).
 */
export interface ScreenshotInfoFormValue {
  shareModIds: boolean;
  shareRenderSettings: boolean;
  isShowcasingAsset: boolean;
  showcasedMod: JsonMod | undefined;
  description: string;
}
