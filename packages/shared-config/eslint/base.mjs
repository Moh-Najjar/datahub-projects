/**
 * Shared ESLint flat-config fragment (code-quality rules only, no plugins, no dependencies).
 * Apps that use ESLint (e.g. the Expo app via `eslint-config-expo`) append it to their config:
 *
 *   const datahub = require('@datahub/shared-config/eslint/base.mjs');
 *   module.exports = defineConfig([expoConfig, ...datahub.default]);
 *
 * The website uses oxlint; its equivalent base lives in `../oxlint/base.json`.
 */
const datahubBase = [
  {
    name: 'datahub/base',
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
    },
  },
];

export default datahubBase;
