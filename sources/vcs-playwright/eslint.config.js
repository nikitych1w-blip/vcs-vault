import eslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import playwright from 'eslint-plugin-playwright';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: parser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': eslint,
      playwright,
    },
    rules: {
      ...eslint.configs.recommended.rules,
      ...eslint.configs.stylistic.rules,
      ...playwright.configs.recommended.rules,
      ...playwright.configs['flat/recommended'].rules,
      ...playwright.configs['playwright-test'].rules,
      'playwright/expect-expect': 'off',
      'playwright/no-skipped-test': 'off',
      'no-console': 'off',
      'no-case-declarations': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='only']",
          message: "We don't want to leave .only on our tests 😱",
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'], // UPPER_CASE для констант
          leadingUnderscore: 'allow', // _unused
        },
        {
          selector: 'variable',
          types: ['array'],
          format: ['camelCase', 'UPPER_CASE'],
        },
        {
          selector: 'function',
          format: ['camelCase'],
        },
        {
          selector: 'class',
          format: ['PascalCase'],
        },
        {
          selector: 'classProperty',
          format: ['camelCase'],
        },
        {
          selector: 'method',
          format: ['camelCase'],
        },
        {
          selector: 'typeLike',
          format: ['PascalCase'],
        },
        {
          selector: 'parameter',
          format: ['camelCase', 'snake_case'], // api
          leadingUnderscore: 'allow', // _unused
        },
      ],
    },
    ignores: [
      'dist/',
      'node_modules/',
      '*.d.ts',
      'node_modules/',
      'test-results/',
      'playwright-report/',
      'allure-report/',
      'allure-results/',
      '.vscode/',
      '.DS_Store',
      'tests/resources/',
      'spec/',
    ],
  },
];
