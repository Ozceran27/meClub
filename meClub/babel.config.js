module.exports = function (api) {
  const isWeb = api.caller((caller) => caller && caller.platform === "web");

  return {
    presets: ["babel-preset-expo"],
    plugins: [
      "nativewind/babel",
      !isWeb && "react-native-reanimated/plugin", // nunca en web y SIEMPRE al final
    ].filter(Boolean),
  };
};