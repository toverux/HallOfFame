import { iconsole } from '../iconsole';
import * as bindings from '../utils/bindings';
import { keepAliveImageUris } from './keep-alive-image-uris';
import * as styles from './keep-alive-images.module.scss';

let installed = false;

/**
 * Installs the keep-alive image manager, which holds a small window of splashscreen images resident
 * in cohtml's cache by referencing them from hidden `display: none` nodes, so slideshow navigation
 * and returns from menu sub-screens / gameplay are flicker-free with no image re-fetch (see
 * {@link keepAliveImageUris} and the image-cache model).
 *
 * Unlike the rest of the mod UI, this is not a React component: it appends its nodes directly to
 * `document.body`. There is no (hookable) mod component that stays mounted across menu, sub-screen,
 * and gameplay states (the game's mount points are torn down on those transitions), and
 * `document.body` is the one permanent known root.
 * It subscribes to the engine bindings imperatively and reconciles the live nodes against the
 * wanted set, reusing a node whenever its image stays in the window so that image is never released
 * (which is what keeps navigation flash-free).
 *
 * Idempotent: safe to call more than once (only the first call installs).
 */
export function installKeepAliveImages(): void {
  if (installed) {
    return;
  }

  installed = true;

  const nodes = new Map<string, HTMLDivElement>();

  let screenshots: bindings.KeepAliveScreenshotsState = {
    current: null,
    prev: null,
    next: null,
    isInMainMenu: true
  };

  // Settings arrive asynchronously from the binding; until then there is no way to resolve a URI,
  // so reconciliation is held back.
  let settings: bindings.ModSettings | undefined;

  // The four keep-alive bindings update independently (the engine has no cross-binding batching),
  // so one navigation fires several subscription callbacks in the same turn, each carrying only a
  // partial window. Coalescing to a single microtask-deferred reconciliation lets it run once
  // against the settled state, never against a torn { prev, current, next } snapshot that would
  // churn nodes.
  let reconcileScheduled = false;

  bindings.subscribeToKeepAliveScreenshots(state => {
    screenshots = state;

    scheduleReconcile();
  });

  bindings.subscribeToModSettings(modSettings => {
    settings = modSettings;

    scheduleReconcile();
  });

  function scheduleReconcile(): void {
    if (reconcileScheduled) {
      return;
    }

    reconcileScheduled = true;

    Promise.resolve()
      .then(() => {
        reconcileScheduled = false;

        if (!settings) {
          return;
        }

        const { current, prev, next, isInMainMenu } = screenshots;

        reconcile(nodes, keepAliveImageUris({ current, prev, next }, isInMainMenu, settings));
      })
      .catch((error: unknown) => {
        iconsole.error(`HoF: Failed to reconcile keep-alive images.`, error);
      });
  }
}

/**
 * Reconciles the live keep-alive nodes against the wanted URI set: removes nodes no longer wanted
 * and creates nodes for newly wanted URIs, leaving a still-wanted URI's node untouched so its image
 * stays continuously referenced.
 */
function reconcile(nodes: Map<string, HTMLDivElement>, uris: readonly string[]): void {
  const wanted = new Set(uris);

  for (const [uri, node] of nodes) {
    if (!wanted.has(uri)) {
      document.body.removeChild(node);

      nodes.delete(uri);
    }
  }

  for (const uri of uris) {
    if (!nodes.has(uri)) {
      nodes.set(uri, createNode(uri));
    }
  }
}

function createNode(uri: string): HTMLDivElement {
  const node = document.createElement('div');

  node.className = styles.node;
  node.style.backgroundImage = `url(${uri})`;

  document.body.appendChild(node);

  return node;
}
