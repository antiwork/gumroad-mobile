const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

// The iOS 27 SDK requires the UIScene life cycle, and UIKit terminates apps that do not adopt it
// (Apple TN3187). Expo SDK 55 has no scene support, so this plugin adds it: the manifest, a
// SceneDelegate, and the React Native startup call that used to live in the app delegate.
// Delete it once the app is on Expo SDK 57, which ships its own scene delegate.

const SCENE_MANIFEST = {
  UIApplicationSupportsMultipleScenes: false,
  UISceneConfigurations: {
    UIWindowSceneSessionRoleApplication: [
      {
        UISceneConfigurationName: "Default Configuration",
        UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
      },
    ],
  },
};

const SCENE_DELEGATE_MARKER = "class SceneDelegate: UIResponder, UIWindowSceneDelegate";

// Exact block the stock AppDelegate template uses to start React Native. Removing it is what
// moves startup into the scene, so a template change must fail loudly rather than silently
// leave the app with two startups or none.
const WINDOW_START = `
#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

const SCENE_DELEGATE = `
${SCENE_DELEGATE_MARKER} {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
      let appDelegate = UIApplication.shared.delegate as? AppDelegate,
      let factory = appDelegate.reactNativeFactory
    else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    // A cold start delivers the URL and user activity to the scene, not the app delegate,
    // so React Native has to read them back out of launchOptions.
    var launchOptions: [UIApplication.LaunchOptionsKey: Any] = [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }
    if let userActivity = connectionOptions.userActivities.first {
      launchOptions[.userActivityDictionary] = [
        UIApplication.LaunchOptionsKey.userActivityType.rawValue: userActivity.activityType,
        // No UIApplication constant for this one; RCTLinkingManager matches the raw name.
        "UIApplicationLaunchOptionsUserActivityKey": userActivity,
      ]
    }

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

const moveStartupToSceneDelegate = (contents) => {
  // prebuild without --clean re-runs mods, so the migration has to be idempotent.
  if (contents.includes(SCENE_DELEGATE_MARKER)) {
    return contents;
  }
  if (!contents.includes(WINDOW_START)) {
    throw new Error(
      "ios-scene-lifecycle: AppDelegate.swift does not match the expected Expo template — re-check the scene migration before building"
    );
  }
  return contents.replace(WINDOW_START, "") + SCENE_DELEGATE;
};

const withIosSceneLifecycle = (config) => {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = SCENE_MANIFEST;
    return config;
  });

  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== "swift") {
      throw new Error("ios-scene-lifecycle: expected a Swift AppDelegate");
    }
    config.modResults.contents = moveStartupToSceneDelegate(config.modResults.contents);
    return config;
  });
};

module.exports = withIosSceneLifecycle;
