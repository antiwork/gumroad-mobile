const { withPodfile } = require("expo/config-plugins");

// Xcode 27 refuses to build pod targets whose deployment target is below 15.0
// ("The iOS deployment target 'IPHONEOS_DEPLOYMENT_TARGET' is set to 11.0, but the
// range of supported deployment target versions is 15.0 to 27.0.x"). CocoaPods keeps
// each podspec's own value, so Sentry (11.0), SDWebImage (9.0) and RNSVG (12.4)
// abort the archive.
//
// Raise only targets that sit below the app's iOS deployment target (15.1) — never
// lower one, or pods that legitimately target a newer iOS (expo-router's LinkPreview
// needs iOS 16) stop compiling.
const MARKER = "# Raise pod deployment targets for Xcode 27+";
const SNIPPET = `    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current.nil? || current.to_f < 15.1
          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end`;

module.exports = (config) =>
  withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes(MARKER)) {
      return config;
    }
    config.modResults.contents = contents.replace(
      /^(\s*)post_install do \|installer\|$/m,
      (match) => `${match}\n${SNIPPET}`,
    );
    return config;
  });
