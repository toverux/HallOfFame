import { describe, expect, it } from 'bun:test';
import type { JsonMod } from '../../utils/bindings';
import { buildUploadPayload, type ScreenshotInfoFormValue } from './form-state';

const baseForm: ScreenshotInfoFormValue = {
  shareModIds: false,
  shareRenderSettings: false,
  isShowcasingAsset: false,
  showcasedMod: undefined,
  description: ''
};

const someMod: JsonMod = {
  id: 'mod-123',
  displayName: 'Some Mod',
  author: 'Some Creator',
  thumbnailPath: 'thumb.png'
};

describe('buildUploadPayload', () => {
  it(`maps the share flags through verbatim`, () => {
    const payload = buildUploadPayload({
      ...baseForm,
      shareModIds: true,
      shareRenderSettings: true
    });

    expect(payload).toEqual({
      shareModIds: true,
      shareRenderSettings: true,
      showcasedModId: null,
      description: ''
    });
  });

  it(`trims the description, mapping whitespace-only text to the empty string`, () => {
    expect(buildUploadPayload({ ...baseForm, description: '  hello  ' })?.description).toBe(
      'hello'
    );
    expect(buildUploadPayload({ ...baseForm, description: '   ' })?.description).toBe('');
    expect(buildUploadPayload({ ...baseForm, description: '' })?.description).toBe('');
  });

  it(`includes the showcased mod id when showcasing an asset with a picked mod`, () => {
    const payload = buildUploadPayload({
      ...baseForm,
      isShowcasingAsset: true,
      showcasedMod: someMod
    });

    expect(payload?.showcasedModId).toBe('mod-123');
  });

  it(`returns undefined when showcasing an asset but no mod is picked`, () => {
    const payload = buildUploadPayload({
      ...baseForm,
      isShowcasingAsset: true,
      showcasedMod: undefined
    });

    expect(payload).toBeUndefined();
  });

  it(`ignores a picked mod when the showcase-asset toggle is off`, () => {
    const payload = buildUploadPayload({
      ...baseForm,
      isShowcasingAsset: false,
      showcasedMod: someMod
    });

    expect(payload?.showcasedModId).toBe(null);
  });
});
