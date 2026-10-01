const withIosSceneLifecycle = require("../../plugins/ios-scene-lifecycle");

// A copy of the Expo SDK 55 AppDelegate template the plugin migrates.
const TEMPLATE = `internal import Expo
import React

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let factory = ExpoReactNativeFactory(delegate: ReactNativeDelegate())
    reactNativeFactory = factory

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
`;

const runAppDelegate = async (contents) => {
  const config = withIosSceneLifecycle({ modResults: { language: "swift", contents }, mods: {} });
  const result = await config.mods.ios.appDelegate(config);
  return result.modResults.contents;
};

const runInfoPlist = async () => {
  const config = withIosSceneLifecycle({ modResults: {}, mods: {} });
  const result = await config.mods.ios.infoPlist(config);
  return result.modResults;
};

describe("ios-scene-lifecycle", () => {
  it("moves React Native startup out of the app delegate into a scene delegate", async () => {
    const out = await runAppDelegate(TEMPLATE);

    expect(out).not.toContain("UIScreen.main.bounds");
    expect(out).not.toContain("#if os(iOS) || os(tvOS)");
    expect(out).toContain("class SceneDelegate: UIResponder, UIWindowSceneDelegate");
    expect(out.match(/startReactNative/g)).toHaveLength(1);
  });

  it("keeps a cold-start URL and user activity readable by React Native", async () => {
    const out = await runAppDelegate(TEMPLATE);

    expect(out).toContain("launchOptions[.url] = url");
    expect(out).toContain("launchOptions[.userActivityDictionary]");
  });

  it("is idempotent when prebuild runs again without --clean", async () => {
    const once = await runAppDelegate(TEMPLATE);

    expect(await runAppDelegate(once)).toBe(once);
  });

  it("fails loudly when the AppDelegate template no longer matches", async () => {
    await expect(runAppDelegate("class AppDelegate {}\n")).rejects.toThrow(
      /does not match the expected Expo template/,
    );
  });

  it("registers the scene delegate in Info.plist", async () => {
    const plist = await runInfoPlist();

    expect(
      plist.UIApplicationSceneManifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication[0]
        .UISceneDelegateClassName,
    ).toBe("$(PRODUCT_MODULE_NAME).SceneDelegate");
  });
});
