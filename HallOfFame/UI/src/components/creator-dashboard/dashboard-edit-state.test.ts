import { describe, expect, it } from 'bun:test';
import type { Screenshot } from '../../common';
import { makeJsonMod, makeMod, makeScreenshot } from '../../testing/fixtures';
import {
  buildScreenshotUpdate,
  canSaveEditForm,
  type EditFormValue,
  initialEditForm,
  selectPickableMods
} from './dashboard-edit-state';

const showcasedMod = makeMod({ paradoxModId: 12, name: 'Old Bridge', authorName: 'Builder' });

const screenshot: Screenshot = makeScreenshot({
  cityName: 'Old Town',
  description: 'A quiet harbour.',
  shareParadoxModIds: true,
  shareRenderSettings: false,
  showcasedMod
});

function edit(changes: Partial<EditFormValue>): EditFormValue {
  return { ...initialEditForm(screenshot), ...changes };
}

describe('initialEditForm', () => {
  it(`holds the screenshot's fields, its showcased mod in the picker's shape`, () => {
    expect(initialEditForm(screenshot)).toEqual({
      cityName: 'Old Town',
      description: 'A quiet harbour.',
      isShowcasingAsset: true,
      showcasedMod: {
        id: '12',
        displayName: 'Old Bridge',
        author: 'Builder',
        thumbnailPath: showcasedMod.thumbnailUrl
      },
      shareParadoxModIds: true,
      shareRenderSettings: false
    });
  });

  it(`leaves the asset unchecked without a showcased mod`, () => {
    const form = initialEditForm(makeScreenshot({ cityName: 'Old Town' }));

    expect(form.isShowcasingAsset).toBe(false);
    expect(form.showcasedMod).toBeUndefined();
  });
});

describe('buildScreenshotUpdate', () => {
  it(`holds nothing while the form is as the screenshot stands`, () => {
    expect(buildScreenshotUpdate(initialEditForm(screenshot), screenshot)).toEqual({});
  });

  it(`holds only the changed fields`, () => {
    const form = edit({ description: 'A busy harbour.', shareRenderSettings: true });

    expect(buildScreenshotUpdate(form, screenshot)).toEqual({
      description: 'A busy harbour.',
      shareRenderSettings: true
    });
  });

  it(`compares trimmed text, as the server stores it`, () => {
    expect(buildScreenshotUpdate(edit({ cityName: '  Old Town ' }), screenshot)).toEqual({});
    expect(buildScreenshotUpdate(edit({ cityName: ' New Town ' }), screenshot)).toEqual({
      cityName: 'New Town'
    });
  });

  it(`sends an emptied description, which clears it`, () => {
    expect(buildScreenshotUpdate(edit({ description: '  ' }), screenshot)).toEqual({
      description: ''
    });
  });

  it(`sends a newly picked showcased mod by its Paradox Mods ID`, () => {
    const pick = makeJsonMod({ id: '34', displayName: 'New Bridge', author: 'Builder' });

    expect(buildScreenshotUpdate(edit({ showcasedMod: pick }), screenshot)).toEqual({
      showcasedModId: '34'
    });
  });

  it(`maps an unchecked showcased asset to an explicit clear`, () => {
    expect(
      buildScreenshotUpdate(edit({ isShowcasingAsset: false, showcasedMod: undefined }), screenshot)
    ).toEqual({ showcasedModId: '' });
  });

  it(`sends nothing for an asset unchecked on a screenshot showcasing none`, () => {
    const plain = makeScreenshot({ cityName: 'Old Town' });

    expect(buildScreenshotUpdate(initialEditForm(plain), plain)).toEqual({});
  });
});

describe('canSaveEditForm', () => {
  it(`refuses while nothing changed`, () => {
    expect(canSaveEditForm(initialEditForm(screenshot), screenshot)).toBe(false);
  });

  it(`allows a valid change`, () => {
    expect(canSaveEditForm(edit({ cityName: 'New Town' }), screenshot)).toBe(true);
  });

  it(`refuses a showcased asset checked without a pick, beside a valid change`, () => {
    expect(
      canSaveEditForm(
        edit({ isShowcasingAsset: true, showcasedMod: undefined, cityName: 'New Town' }),
        screenshot
      )
    ).toBe(false);
  });
});

describe('selectPickableMods', () => {
  const assetMod = makeJsonMod({ id: '34', displayName: 'New Bridge' });

  it(`offers the playset's asset mods, holding the showcased one`, () => {
    const playsetMods = [makeJsonMod({ id: '12', displayName: 'Old Bridge' }), assetMod];

    expect(selectPickableMods(playsetMods, showcasedMod).map(mod => mod.id)).toEqual(['12', '34']);
  });

  it(`offers the showcased mod first when the playset lacks it`, () => {
    expect(selectPickableMods([assetMod], showcasedMod).map(mod => mod.id)).toEqual(['12', '34']);
  });

  it(`offers only the showcased mod when the playset could not be read`, () => {
    expect(selectPickableMods([], showcasedMod).map(mod => mod.id)).toEqual(['12']);
  });

  it(`offers nothing without a playset or a showcased mod`, () => {
    expect(selectPickableMods([])).toEqual([]);
  });
});
