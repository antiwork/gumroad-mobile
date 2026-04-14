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

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./app/global.css",
});
