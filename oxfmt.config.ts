import config from '@toverux/blanc-hopital/oxfmt';
import { defineConfig } from 'oxfmt';

// oxlint-disable-next-line import/no-default-export - oxfmt interface
export default defineConfig({
  // Agent prose keeps its own layout rules; .agents/hooks is source and gets formatted.
  ignorePatterns: ['.agents/rules', '.agents/skills', '.claude', '.config'],
  ...config
});
