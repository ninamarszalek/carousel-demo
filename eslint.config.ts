import js from '@eslint/js';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier/flat';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { importX } from 'eslint-plugin-import-x';
import jestDom from 'eslint-plugin-jest-dom';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import playwright from 'eslint-plugin-playwright';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import testingLibrary from 'eslint-plugin-testing-library';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const TEST_FILES = ['**/*.test.{ts,tsx}', 'tests/setup/**', 'tests/mocks/**'];

/** eslint-plugin-react types its flat configs as optional; fail loudly instead of silently skipping them. */
function required<T>(config: T | undefined, name: string): T {
  if (config === undefined) {
    throw new Error(`ESLint config "${name}" not found. Check the installed plugin version.`);
  }
  return config;
}

export default defineConfig(
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results']),

  // --- Base: JS + type-aware TypeScript -----------------------------------------------------
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'all' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: false }],
      curly: ['error', 'all'],
      eqeqeq: ['error', 'always'],
      'object-shorthand': 'error',
      'prefer-const': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // --- Imports: hygiene, ordering and architecture boundaries -------------------------------
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: ['tsconfig.app.json', 'tsconfig.node.json', 'tsconfig.test.json'],
          noWarnOnMultipleProjects: true,
        }),
      ],
    },
    rules: {
      // TypeScript already validates imports; this rule only flags documented usages like `tseslint.configs`.
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-default-export': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-useless-path-segments': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // Architecture boundaries (see specs/project-setup.md §4).
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src',
              from: './server',
              message: 'Client code must not import server code.',
            },
            {
              target: './server',
              from: './src',
              except: ['./types'],
              message: 'Server code may only import shared types from src/types.',
            },
            {
              target: './src/components',
              from: ['./src/features', './src/pages'],
              message: 'Shared components must stay domain-agnostic.',
            },
            {
              target: './src/features',
              from: './src/pages',
              message: 'Features must not depend on pages.',
            },
          ],
        },
      ],
    },
  },

  // --- React (client and isomorphic code) ---------------------------------------------------
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      required(react.configs.flat.recommended, 'react/recommended'),
      required(react.configs.flat['jsx-runtime'], 'react/jsx-runtime'),
      reactHooks.configs.flat['recommended-latest'],
      jsxA11y.flatConfigs.strict,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      'react/jsx-no-useless-fragment': 'error',
      'react/self-closing-comp': 'error',
      'react/no-array-index-key': 'error',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/function-component-definition': [
        'error',
        { namedComponents: 'function-declaration', unnamedComponents: 'arrow-function' },
      ],
    },
  },

  // --- Node (server, tooling configs) ------------------------------------------------------
  {
    files: ['server/**/*.ts', '*.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // The server logs to stdout on purpose.
    files: ['server/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    // Tooling expects default exports from config files.
    files: ['*.config.{ts,mjs}'],
    rules: {
      'import-x/no-default-export': 'off',
    },
  },
  {
    // Plain JS config files are not part of any tsconfig, so type-aware rules cannot run on them.
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: globals.node,
    },
  },

  // --- Tests -------------------------------------------------------------------------------
  {
    files: TEST_FILES,
    extends: [vitest.configs.recommended],
    rules: {
      'vitest/consistent-test-it': ['error', { fn: 'it' }],
      // Helpers named `expect…` (e.g. `expectCaption`) contain assertions.
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*'] }],
      'vitest/no-focused-tests': 'error',
      'vitest/prefer-strict-equal': 'off',
    },
  },
  {
    // React Testing Library rules apply to DOM tests only, not to SSR (node) tests.
    files: ['src/**/*.test.{ts,tsx}'],
    ignores: ['src/**/*.ssr.test.{ts,tsx}'],
    extends: [testingLibrary.configs['flat/react'], jestDom.configs['flat/recommended']],
  },
  {
    files: ['tests/e2e/**/*.ts'],
    extends: [playwright.configs['flat/recommended']],
  },

  // Must be last: turns off rules that conflict with Prettier.
  prettier,
);
