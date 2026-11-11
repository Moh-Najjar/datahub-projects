// https://docs.expo.dev/guides/using-eslint/
import expoConfig from 'eslint-config-expo/flat.js';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  expoConfig,
  {
    name: 'datahub-hr/code-quality',
    rules: {
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
    },
  },
  {
    name: 'datahub-hr/app-boundaries',
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@mui/*', '@emotion/*', 'react-dom', 'react-dom/*', 'react-router', 'react-router-dom', 'stylis', 'stylis-*'],
              message: 'DataHubHR is a React Native app: web UI libraries belong to apps/datahub-website.',
            },
            {
              group: ['**/datahub-website', '**/datahub-website/**', 'datahub-website', 'datahub-website/*'],
              message: 'Apps must not import each other. Share types through @datahub/shared-types.',
            },
          ],
        },
      ],
    },
  },
  { ignores: ['dist/*', '.expo/*'] },
]);
