const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// This is an npm workspaces monorepo: react and react-native are hoisted to
// the root node_modules and pinned there by root package.json's
// dependencies + overrides. Expo's default config (getDefaultConfig above)
// already configures Metro's monorepo lookup (watchFolders, nodeModulesPaths)
// to find them, so no resolver overrides are needed here. A single copy of
// react and react-native ends up in the bundle — verified in phase 01.3 by
// the source-map single-copy check recorded in 01.3-03-SUMMARY.md.

module.exports = config;
