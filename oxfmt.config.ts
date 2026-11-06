import config from '@toverux/blanc-hopital/oxfmt';
import { defineConfig } from 'oxfmt';

// oxlint-disable-next-line import/no-default-export - oxfmt interface
export default defineConfig({
  // Agent prose (the skills and rules) keeps its own layout rules.
  // The cs2 types are the game's own files, copied as they are.
  ignorePatterns: [
    '.claude',
    '.agents/skills',
    '.agents/rules',
    '.config',
    'HallOfFame/UI/cs2-types'
  ],
  ...config
});
