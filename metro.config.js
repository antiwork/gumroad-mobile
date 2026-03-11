const { withUniwindConfig } = require("uniwind/metro");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname, {
  annotateReactComponents: true,
});

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./app/global.css",
});
