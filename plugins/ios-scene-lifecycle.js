const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

// The iOS 27 SDK requires the UIScene life cycle, and UIKit terminates apps that
// do not adopt it ("Application failed to launch: UIScene life cycle is required
// for apps built with this SDK"). React Native startup therefore moves out of
// application(_:didFinishLaunchingWithOptions:) into a scene delegate.

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

const WINDOW_START = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif`;

const SCENE_DELEGATE = `
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
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
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: nil)
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

const STARTUP_MOVED = `    // React Native startup lives in SceneDelegate; see ios-scene-lifecycle.`;

const moveStartupToSceneDelegate = (contents) => {
  // prebuild without --clean re-runs mods, so the migration has to be idempotent.
  if (contents.includes(STARTUP_MOVED)) {
    return contents;
  }
  if (!contents.includes(WINDOW_START)) {
    throw new Error(
      "ios-scene-lifecycle: AppDelegate.swift does not match the expected Expo template — re-check the scene migration before building"
    );
  }
  return contents.replace(WINDOW_START, STARTUP_MOVED) + SCENE_DELEGATE;
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
