const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

const sharedPath = path.resolve(__dirname, '..', 'shared');

config.watchFolders = [sharedPath];

config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    ...config.resolver?.extraNodeModules,
    shared: sharedPath,
  },
};

module.exports = withNativeWind(config, {
  input: './global.css',
});
