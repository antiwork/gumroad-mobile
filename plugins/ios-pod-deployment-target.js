const { withPodfile } = require("expo/config-plugins");

// Raise only pod targets below the app's 15.1: lowering a target that needs a newer
// iOS (expo-router's LinkPreview needs 16) stops that pod compiling.
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

const raisePodDeploymentTargets = (contents) => {
  if (contents.includes(MARKER)) {
    return contents;
  }
  const postInstall = /^(\s*)post_install do \|installer\|/m;
  if (!postInstall.test(contents)) {
    throw new Error("ios-pod-deployment-target: the generated Podfile has no post_install hook to insert into");
  }
  return contents.replace(postInstall, (match) => `${match}\n${SNIPPET}`);
};

const withIosPodDeploymentTarget = (config) =>
  withPodfile(config, (config) => {
    config.modResults.contents = raisePodDeploymentTargets(config.modResults.contents);
    return config;
  });

module.exports = withIosPodDeploymentTarget;
module.exports.raisePodDeploymentTargets = raisePodDeploymentTargets;
