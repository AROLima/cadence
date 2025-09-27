import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import pluginSvelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

const svelteRecommended = pluginSvelte.configs['flat/recommended'];
const tsRecommended = tsPlugin.configs.recommended;

export default [
  {
    ignores: ['.svelte-kit/**', 'build/**', 'node_modules/**'],
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.svelte'],
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      svelte: pluginSvelte,
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...svelteRecommended.rules,
      'svelte/no-at-html-tags': 'error',
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsRecommended.rules,
      'no-console': ['warn', { allow: ['info', 'warn', 'error'] }],
    },
  },
];
