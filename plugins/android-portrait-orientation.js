const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

const setAndroidPortraitOrientation = (androidManifest) => {
  const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(androidManifest);
  mainActivity.$["android:screenOrientation"] = "portrait";
  return androidManifest;
};

const withAndroidPortraitOrientation = (config) =>
  withAndroidManifest(config, (config) => {
    config.modResults = setAndroidPortraitOrientation(config.modResults);
    return config;
  });

module.exports = withAndroidPortraitOrientation;
module.exports.setAndroidPortraitOrientation = setAndroidPortraitOrientation;
