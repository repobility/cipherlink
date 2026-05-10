// ESLint flat config — separate Node and browser layers so neither has to
// declare globals it doesn't use.

const js = require('@eslint/js');
const globals = require('globals');

/**
 * @returns {import('eslint').Linter.Config[]}
 */
function buildConfig() {
  return [
    js.configs.recommended,
    nodeLayer(),
    browserLayer(),
    { ignores: ['node_modules/', 'public/vendor/', 'coverage/', 'dist/', '.cache/'] },
  ];
}

/** @returns {import('eslint').Linter.Config} */
function nodeLayer() {
  return {
    files: ['server.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node, fetch: 'readonly' },
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off',
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  };
}

/** @returns {import('eslint').Linter.Config} */
function browserLayer() {
  return {
    files: ['public/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        nacl: 'readonly',
        nacl_util: 'readonly',
        naclUtil: 'readonly',
        CL_Crypto: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-restricted-globals': [
        'error',
        {
          name: 'Math.random',
          message: 'Use crypto.getRandomValues — Math.random is not cryptographically safe.',
        },
      ],
    },
  };
}

module.exports = buildConfig();
