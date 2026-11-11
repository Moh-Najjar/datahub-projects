// Learn more: https://docs.expo.dev/guides/monorepos/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

/*
 * Single React instance for the mobile bundle.
 *
 * The monorepo intentionally keeps two React patch versions: the website uses 19.3.1 and Expo SDK 58
 * pins 19.3.0. npm may hoist either one to the root node_modules, where a hoisted `react-native`
 * would otherwise resolve the website's React — two Reacts in one bundle ("Invalid hook call").
 * Every `react` / `react/*` import in this app's bundle is therefore pinned to this app's own copy.
 */
const reactRoot = path.dirname(require.resolve('react/package.json', { paths: [__dirname] }));

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return context.resolveRequest({ ...context, originModulePath: path.join(reactRoot, 'index.js') }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
