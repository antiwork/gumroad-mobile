const { withUniwindConfig } = require("uniwind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname, {
  annotateReactComponents: true,
});

config.resolver.blockList = [...(config.resolver.blockList || []), /\.env\.build\.local$/];

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./app/global.css",
});
