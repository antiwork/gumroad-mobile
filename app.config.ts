import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Gumroad",
  slug: "gumroad",
  version: "2026.04.04",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "gumroadmobile",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: process.env.IOS_BUNDLE_NAME,
    infoPlist: {
      UIBackgroundModes: ["audio", "remote-notification", "fetch"],
      ITSAppUsesNonExemptEncryption: false,
      UIDesignRequiresCompatibility: true,
      NSPhotoLibraryAddUsageDescription:
        "Gumroad needs access to save files to your photo library when you choose to download content.",
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#FFFFFF",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    package: process.env.ANDROID_BUNDLE_NAME,
    googleServicesFile: "./google-services.json",
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
    "expo-image",
    "expo-sharing",
    [
      "expo-widgets",
      {
        widgets: [
          {
            name: "RevenueWidget",
            displayName: "Gumroad",
            description: "Revenue totals",
            contentMarginsDisabled: true,
            supportedFamilies: ["systemSmall"],
          },
        ],
      },
    ],
    [
      "react-native-android-widget",
      {
        fonts: ["./assets/fonts/ABCFavorit-Regular-custom.ttf", "./assets/fonts/ABCFavorit-Bold-custom.ttf"],
        widgets: [
          {
            name: "RevenueWidget",
            label: "Gumroad",
            description: "Revenue totals",
            previewImage: "./assets/images/widget-preview.png",
            minWidth: "110dp",
            minHeight: "110dp",
            targetCellWidth: 2,
            targetCellHeight: 2,
            resizeMode: "horizontal|vertical",
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
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
