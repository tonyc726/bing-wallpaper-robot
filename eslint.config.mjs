import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['docs/**', 'website/**', 'node_modules/**', 'database/**', 'scripts/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['crawler/**/*.ts'],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/explicit-member-accessibility': 'warn',
      // Keep the previous ESLint 8 + alloy failure surface: unused catch bindings
      // and empty catch blocks are existing crawler style, not new debt from this upgrade.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
        },
      ],
      'no-empty': 'off',
      'prefer-const': 'warn',
      'no-useless-escape': 'warn',
    },
  },
);
