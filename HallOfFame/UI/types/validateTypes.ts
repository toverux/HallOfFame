import { ModRegistrar } from "cs2/modding";

export async function validateExportTypes() {
    // only default export is processed by the UI, any named exports will be ignored.
    let isIndexFileValid: { 'default': ModRegistrar } = await import('../src/index');
    return isIndexFileValid;
}
