const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

// The iOS 27 SDK requires the UIScene life cycle, and UIKit terminates apps that do not adopt it
// (Apple TN3187). Expo SDK 55 has no scene support, so this plugin adds it: the manifest, a
// SceneDelegate, and the React Native startup call that used to live in the app delegate. Only
// launches in the background, which have no scene, still start React Native from the app delegate.
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

const BACKGROUND_START = `
#if os(iOS) || os(tvOS)
    // iOS can launch the app without any screen, for example to run a background fetch. No scene
    // connects in that case, so React Native has to start here or the background task never runs.
    // Launches that show the app start it from the scene delegate, which also picks up this root
    // if the user opens the app later.
    if application.applicationState == .background {
      window = UIWindow(frame: UIScreen.main.bounds)
      factory.startReactNative(
        withModuleName: "main",
        in: window,
        launchOptions: launchOptions)
    }
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
    let previousWindow = appDelegate.window
    appDelegate.window = window

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

    // Once an app adopts scenes, UIKit stops calling the app delegate's open and continue
    // methods, which are where Expo's linking module records the initial URL. Forwarding
    // through the app delegate, before React Native starts, keeps that path working.
    open(connectionOptions.urlContexts, appDelegate: appDelegate)
    for userActivity in connectionOptions.userActivities {
      continueUserActivity(userActivity, appDelegate: appDelegate)
    }

    // UIKit can disconnect a scene and later connect a new one while the process, and the
    // React Native host inside it, stays alive. Starting React Native again would mount a
    // second root view with fresh JS state, so the running one moves to the new window.
    if let rootViewController = previousWindow?.rootViewController {
      previousWindow?.rootViewController = nil
      window.rootViewController = rootViewController
      window.makeKeyAndVisible()
      return
    }

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    open(URLContexts, appDelegate: appDelegate)
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    continueUserActivity(userActivity, appDelegate: appDelegate)
  }

  private func open(_ urlContexts: Set<UIOpenURLContext>, appDelegate: AppDelegate) {
    for urlContext in urlContexts {
      var options: [UIApplication.OpenURLOptionsKey: Any] = [
        .openInPlace: urlContext.options.openInPlace
      ]
      if let sourceApplication = urlContext.options.sourceApplication {
        options[.sourceApplication] = sourceApplication
      }
      if let annotation = urlContext.options.annotation {
        options[.annotation] = annotation
      }
      _ = appDelegate.application(UIApplication.shared, open: urlContext.url, options: options)
    }
  }

  private func continueUserActivity(_ userActivity: NSUserActivity, appDelegate: AppDelegate) {
    _ = appDelegate.application(
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
  return contents.replace(WINDOW_START, () => BACKGROUND_START) + SCENE_DELEGATE;
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
