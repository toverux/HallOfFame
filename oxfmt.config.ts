import config from '@toverux/blanc-hopital/oxfmt';
import { defineConfig } from 'oxfmt';

// oxlint-disable-next-line import/no-default-export - oxfmt interface
export default defineConfig({
  // Agent prose keeps its own layout rules; .agents/hooks is source and gets formatted.
  // The cs2 types are the game's own files, copied as they are.
  ignorePatterns: [
    '.agents/rules',
    '.agents/skills',
    '.claude',
    '.config',
    'HallOfFame/UI/cs2-types'
  ],
  ...config
});
