import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['node_modules', '../_site', 'src/data/database.types.ts'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
    },
  },
  {
    // UI rule 1 (UI_RULES.md): form boxes come from ui/Field so they are iPhone-safe and consistent.
    files: ['src/**/*.tsx'],
    ignores: ['src/ui/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...['input', 'select', 'textarea'].map((tag) => ({
          selector: `JSXOpeningElement[name.name='${tag}']`,
          message: `Do not use a raw <${tag}>. Use Input, DateInput or Select from ui/Field (UI_RULES.md rule 1).`,
        })),
      ],
    },
  },
  {
    // Playwright script: runs in Node, and page.evaluate() bodies run in the browser.
    files: ['browser/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
