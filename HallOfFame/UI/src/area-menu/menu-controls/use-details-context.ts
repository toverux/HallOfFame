import { useMemo } from 'react';
import * as bindings from '../../utils/bindings';
import type { DetailsContext } from './screenshot-details';

/**
 * What a screenshot's details depend on besides the screenshot, stable across renders until one of
 * its parts changes.
 */
export function useDetailsContext(): DetailsContext {
  const photoModeCatalog = bindings.usePhotoModeCatalog();

  const viewerCreatorId = bindings.useModSettings().publicCreatorId ?? undefined;

  const playset = bindings.usePlayset() ?? undefined;

  return useMemo(
    () => ({ photoModeCatalog, viewerCreatorId, playset }),
    [photoModeCatalog, viewerCreatorId, playset]
  );
}
