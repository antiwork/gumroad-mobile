import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Gumroad",
  slug: "gumroad",
  version: "2026.02.01",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "gumroadmobile",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: process.env.IOS_BUNDLE_NAME,
    infoPlist: {
      UIBackgroundModes: ["audio"],
      ITSAppUsesNonExemptEncryption: false,
      UIDesignRequiresCompatibility: true,
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: process.env.ANDROID_BUNDLE_NAME,
  },
  androidNavigationBar: {
    enforceContrast: false,
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-font",
      {
        fonts: [
          "./assets/fonts/ABCFavorit-Regular-custom.ttf",
          "./assets/fonts/ABCFavorit-Bold-custom.ttf",
          "./assets/fonts/ABCFavorit-RegularItalic-custom.ttf",
          "./assets/fonts/ABCFavorit-BoldItalic-custom.ttf",
        ],
        android: {
          fonts: [
            {
              fontFamily: "ABC Favorit",
              fontDefinitions: [
                { path: "./assets/fonts/ABCFavorit-Regular-custom.ttf", weight: 400 },
                { path: "./assets/fonts/ABCFavorit-Bold-custom.ttf", weight: 700 },
                { path: "./assets/fonts/ABCFavorit-RegularItalic-custom.ttf", weight: 400, style: "italic" },
                { path: "./assets/fonts/ABCFavorit-BoldItalic-custom.ttf", weight: 700, style: "italic" },
              ],
            },
          ],
        },
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    "expo-updates",
    "expo-secure-store",
    "expo-web-browser",
    "expo-video",
    [
      "@sentry/react-native/expo",
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
    ],
  ],
  updates: {
    enabled: true,
    url: `https://u.expo.dev/${process.env.EAS_PROJECT_ID}`,
    fallbackToCacheTimeout: 0,
    checkAutomatically: "ON_LOAD",
  },
  runtimeVersion: {
    policy: "appVersion",
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});
