/**
 * ESLint config compartilhada do monorepo.
 *
 * Estrategia: configuracao unica no root (TypeScript + import) com override
 * para apps/web (React + hooks). Pacotes que precisarem de regras adicionais
 * podem criar `.eslintrc.cjs` proprio com `extends: ['../../.eslintrc.cjs']`.
 *
 * ADR pendente em packages/config (CLAUDE.md) consolidara ESLint/TSConfig
 * em um pacote dedicado quando o setup amadurecer.
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
    // Permite escrever testes sem fricao (vitest expoe describe/it/expect via globals).
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    // CLAUDE.md exige sem `any` implicito; explicit `any` ainda e tolerado em
    // pontos de borda (mocks de teste, casts) com warning para revisar.
    '@typescript-eslint/no-explicit-any': 'warn',
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
};
