/**
 * ESLint config compartilhada do monorepo.
 *
 * Estrategia: configuracao unica no root (TypeScript + import) com override
 * para apps/web (React + hooks). Pacotes que precisarem de regras adicionais
 * podem criar `.eslintrc.cjs` proprio com `extends: ['../../.eslintrc.cjs']`.
 *
 * ADR pendente em packages/config (CLAUDE.md) consolidara ESLint/TSConfig
 * em um pacote dedicado quando o setup amadurecer.
 *
 * Regras alinhadas a CLAUDE.md (TypeScript estrito, sem `any` implicito).
 */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // CLAUDE.md exige TypeScript estrito; explicit `any` so e permitido em
    // pontos de borda explicitos (mocks de teste) via override abaixo.
    '@typescript-eslint/no-explicit-any': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      files: ['apps/web/**/*.{ts,tsx}'],
      plugins: ['react', 'react-hooks'],
      extends: [
        'plugin:react/recommended',
        'plugin:react-hooks/recommended',
      ],
      settings: {
        react: { version: 'detect' },
      },
      env: {
        browser: true,
      },
      rules: {
        // React 18 + JSX runtime automatico (Vite) - import React desnecessario.
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
      },
    },
    {
      files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
      env: {
        node: true,
      },
      rules: {
        // Mocks de teste comumente recebem unknown[] e usam any para flex.
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    'coverage',
    '.turbo',
    '.next',
    '.vite',
    '*.config.js',
    '*.config.cjs',
    '*.config.ts',
  ],
};
