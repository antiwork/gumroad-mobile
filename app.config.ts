import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Gumroad",
  slug: "gumroad-mobile",
  version: "1.0.0",
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
    "expo-secure-store",
    "expo-web-browser",
    "expo-video",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
});
