const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// In this monorepo, keep Metro resolution pinned to mobile/node_modules
// so React / React Native versions remain consistent with the mobile workspace.
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../node_modules')
];
config.resolver.disableHierarchicalLookup = true;
config.resolver.extraNodeModules = {
  react: path.resolve(__dirname, 'node_modules/react'),
  'react-native': path.resolve(__dirname, 'node_modules/react-native')
};

module.exports = config;
