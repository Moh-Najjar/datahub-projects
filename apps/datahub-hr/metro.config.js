// Learn more: https://docs.expo.dev/guides/monorepos/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

// Expo configures monorepo module resolution automatically (root node_modules lookup).
const config = getDefaultConfig(projectRoot);

/*
 * Watch only what this app can import. Expo's default watches every workspace, including the whole
 * website (sources, public assets, build output). The project root is always watched by Metro.
 */
config.watchFolders = [
  path.join(monorepoRoot, 'node_modules'), // hoisted dependencies
  path.join(monorepoRoot, 'packages', 'shared-types'),
];

module.exports = config;
