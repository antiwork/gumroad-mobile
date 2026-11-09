const { withPodfile } = require("expo/config-plugins");

// RN's prebuilt React.framework ships without a dSYM, so a Release archive carries none and
// Sentry can only resolve names out of the symbol table: no file, no line, and template frames
// stay as std::__1::__function::__func<T>::operator(). This flag makes CocoaPods download that
// dSYM and leave it next to the framework, where the archive and its Sentry upload step pick it
// up. hermesvm and ReactNativeDependencies are not covered by it — see
// scripts/upload-ios-release-symbols.sh.
const MARKER = "# Keep prebuilt framework dSYMs for symbolication";
const SNIPPET = `${MARKER}\nENV['RCT_SYMBOLICATE_PREBUILT_FRAMEWORKS'] ||= '1'`;
const ANCHOR = /^prepare_react_native_project!$/m;

const keepPrebuiltFrameworkDsyms = (contents) => {
  if (contents.includes(MARKER)) {
    return contents;
  }
  if (!ANCHOR.test(contents)) {
    throw new Error("ios-prebuilt-framework-symbols: the generated Podfile has no prepare_react_native_project! line");
  }
  return contents.replace(ANCHOR, (match) => `${SNIPPET}\n${match}`);
};

const withIosPrebuiltFrameworkSymbols = (config) =>
  withPodfile(config, (config) => {
    config.modResults.contents = keepPrebuiltFrameworkDsyms(config.modResults.contents);
    return config;
  });

module.exports = withIosPrebuiltFrameworkSymbols;
module.exports.keepPrebuiltFrameworkDsyms = keepPrebuiltFrameworkDsyms;
