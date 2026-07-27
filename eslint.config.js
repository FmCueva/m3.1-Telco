// Flat config CJS (el repo no lleva "type": "module").
// Recommended sin type-check: suficiente para la demo y no exige project service.
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/', '*.cjs'] },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'scripts/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    // Gate de complejidad del Módulo Construcción (vídeo 7): error, no warning.
    files: ['src/**/*.ts'],
    rules: {
      complexity: ['error', { max: 10 }],
      'max-lines-per-function': ['error', { max: 50 }],
      'max-depth': ['error', { max: 3 }],
      'max-params': ['error', { max: 4 }],
    },
  },
);
