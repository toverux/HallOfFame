import agnostic from '@toverux/blanc-hopital/oxlint/agnostic';
import all from '@toverux/blanc-hopital/oxlint/all';
import react from '@toverux/blanc-hopital/oxlint/react';
import reactPerfRelaxed from '@toverux/blanc-hopital/oxlint/react-perf-relaxed';
import { defineConfig } from 'oxlint';

// oxlint-disable-next-line import/no-default-export - oxlint interface
export default defineConfig({
  extends: [all, agnostic, react, reactPerfRelaxed],
  plugins: ['jest'],
  ignorePatterns: ['vanilla-modules.source.js'],
  rules: {
    // Jest (bun test) rules that conflict with production code, that we re-enable below with an
    // override on .test.* files.
    'jest/require-hook': 'off',

    // A11y rule that is useless in HoF.
    'jsx-a11y/alt-text': 'off',
    // A11y rule that is useless in HoF: the game UI is driven by the engine's gamepad/focus system,
    // not by DOM keyboard events, and clickable elements wrap game controls that are already
    // keyboard-accessible. This is the inseparable sibling of `no-static-element-interactions`.
    'jsx-a11y/click-events-have-key-events': 'off',
    // A11y rule that is useless in HoF.
    'jsx-a11y/no-static-element-interactions': 'off',

    // Useless in HoF as we can't use React DevTools.
    'react/display-name': 'off',
    // In HoF we routinely pass typed binding command functions (e.g. `bindings.clearScreenshot`)
    // directly as `onSelect`/`onChange` handlers; those command names cannot follow the rule's
    // `handle*` convention, so enforcing it here only fights the binding pattern.
    'react/jsx-handler-names': 'off',
    // In this project we often split big components into smaller ones but keep them in one file.
    // But that is only for components that are very tied to their parent; generic components must
    // still be extracted.
    'react/no-multi-comp': 'off',

    // Cohtml does not support those DOM APIs.
    'unicorn/prefer-dom-node-append': 'off',
    'unicorn/prefer-dom-node-dataset': 'off',
    'unicorn/prefer-dom-node-remove': 'off',
    'unicorn/prefer-dom-node-text-content': 'off',
    'unicorn/prefer-modern-dom-apis': 'off'
  },
  overrides: [
    {
      // Ambient declaration files must stay scripts (no top-level import/export) for their global
      // `declare module` blocks to register, so `import/unambiguous` (which wants a module) can
      // never be satisfied here.
      files: ['*.d.ts'],
      rules: {
        'import/unambiguous': 'off'
      }
    },
    {
      files: ['*.test.{ts,tsx}'],
      rules: {
        // Re-enable rule disabled above.
        'jest/require-hook': 'deny'
      }
    }
  ]
});
