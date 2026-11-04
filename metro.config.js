const { withUniwindConfig } = require("uniwind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname, {
  annotateReactComponents: true,
});

config.resolver.blockList = [...(config.resolver.blockList || []), /\.env\.build\.local$/];

// Force @tanstack/query-core to resolve its legacy (CJS) build instead of the
// modern ESM build. The modern build uses native JS private fields (#field),
// which are incompatible with Babel's loose-mode class-properties transform
// shipped by @react-native/babel-preset. The mismatch causes a runtime
// "TypeError: attempted to use private field on non-instance" on Hermes.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@tanstack/query-core") {
    return context.resolveRequest({ ...context, unstable_conditionNames: ["require"] }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

const uniwindConfig = withUniwindConfig(config, {
  cssEntryFile: "./app/global.css",
});

// Uniwind's resolver rewrites every `react-native` import outside react-native itself to
// `uniwind/components`, whose styled wrappers are not constructible — react-native-pdf
// subclasses FlatList, so that rewrite makes app/pdf-viewer.tsx throw at require time and the
// PDF screen never loads. Hand react-native-pdf the real module instead.
const resolvesWithUniwind = uniwindConfig.resolver.resolveRequest;

uniwindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native" && context.originModulePath.includes("node_modules/react-native-pdf/")) {
    return context.resolveRequest(context, moduleName, platform);
  }

  return resolvesWithUniwind(context, moduleName, platform);
};

module.exports = uniwindConfig;
