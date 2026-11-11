// https://docs.expo.dev/guides/using-eslint/
import datahubBase from '@datahub/shared-config/eslint/base.mjs';
import expoConfig from 'eslint-config-expo/flat.js';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  expoConfig,
  // Shared DataHub code-quality rules.
  ...datahubBase,
  { ignores: ['dist/*', '.expo/*'] },
]);
