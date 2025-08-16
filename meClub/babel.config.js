module.exports = function (api) {
  const isWeb = api.caller((caller) => caller && caller.platform === 'web');

  return {
    presets: [
      'babel-preset-expo',
      'nativewind/babel',
    ],
    plugins: [
      !isWeb && 'react-native-reanimated/plugin',
    ].filter(Boolean),
  };
};
