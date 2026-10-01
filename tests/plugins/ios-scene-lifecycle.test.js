const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const withIosSceneLifecycle = require("../../plugins/ios-scene-lifecycle");

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

const sceneDelegateOf = (swift) => swift.slice(swift.indexOf("class SceneDelegate"));

const bodyOf = (swift, signature) => {
  const start = swift.indexOf(signature);
  if (start === -1) {
    throw new Error(`missing ${signature}`);
  }
  const open = swift.indexOf("{", swift.indexOf(")", start));
  let depth = 0;
  for (let i = open; i < swift.length; i++) {
    if (swift[i] === "{") depth++;
    if (swift[i] === "}" && --depth === 0) return swift.slice(open, i + 1);
  }
  throw new Error(`unbalanced ${signature}`);
};

const DID_FINISH_LAUNCHING =
  "public override func application(\n    _ application: UIApplication,\n    didFinishLaunchingWithOptions";
const WILL_CONNECT = "func scene(\n    _ scene: UIScene,\n    willConnectTo";
const OPEN_URL_CONTEXTS = "func scene(_ scene: UIScene, openURLContexts";
const CONTINUE_ACTIVITY = "func scene(_ scene: UIScene, continue userActivity";
const OPEN_HELPER = "private func open(";
const CONTINUE_HELPER = "private func continueUserActivity(";

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
  it("starts React Native for a foreground launch from the scene delegate", async () => {
    const out = await runAppDelegate(TEMPLATE);
    const scene = sceneDelegateOf(out);

    expect(out).toContain("class SceneDelegate: UIResponder, UIWindowSceneDelegate");
    expect(scene.match(/startReactNative/g)).toHaveLength(1);
    expect(out.match(/startReactNative/g)).toHaveLength(2);
  });

  it("starts React Native from the app delegate only when the launch is in the background", async () => {
    const out = await runAppDelegate(TEMPLATE);
    const launch = bodyOf(out, DID_FINISH_LAUNCHING);
    const guard = launch.indexOf("if application.applicationState == .background {");
    const start = launch.indexOf("factory.startReactNative");
    const guardEnd = launch.indexOf("\n    }\n", guard);

    expect(guard).toBeGreaterThan(-1);
    expect(start).toBeGreaterThan(guard);
    expect(start).toBeLessThan(guardEnd);
    expect(launch.match(/startReactNative/g)).toHaveLength(1);
    expect(launch.indexOf("return super.application")).toBeGreaterThan(guardEnd);
  });

  it("keeps the background-launch root reachable so a later scene reuses it", async () => {
    const out = await runAppDelegate(TEMPLATE);
    const launch = bodyOf(out, DID_FINISH_LAUNCHING);
    const connect = bodyOf(sceneDelegateOf(out), WILL_CONNECT);

    expect(launch).toMatch(
      /window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s+factory\.startReactNative\(\n\s+withModuleName: "main",\n\s+in: window,\n\s+launchOptions: launchOptions\)/,
    );
    expect(connect).toContain("let previousWindow = appDelegate.window");
    expect(connect).toContain("window.rootViewController = rootViewController");
  });

  it("keeps a cold-start URL and user activity readable by React Native", async () => {
    const out = await runAppDelegate(TEMPLATE);

    expect(out).toContain("launchOptions[.url] = url");
    expect(out).toContain("launchOptions[.userActivityDictionary]");
  });

  it("hands the cold-start URL and user activity to the app delegate before React Native starts", async () => {
    const connect = bodyOf(sceneDelegateOf(await runAppDelegate(TEMPLATE)), WILL_CONNECT);
    const start = connect.indexOf("factory.startReactNative");

    const openCall = connect.indexOf("open(connectionOptions.urlContexts, appDelegate: appDelegate)");
    const continueCall = connect.indexOf("continueUserActivity(userActivity, appDelegate: appDelegate)");
    expect(openCall).toBeGreaterThan(-1);
    expect(continueCall).toBeGreaterThan(-1);
    expect(openCall).toBeLessThan(start);
    expect(continueCall).toBeLessThan(start);
  });

  it("routes warm URL opens and user activities through the app delegate", async () => {
    const scene = sceneDelegateOf(await runAppDelegate(TEMPLATE));

    expect(bodyOf(scene, OPEN_URL_CONTEXTS)).toContain("open(URLContexts, appDelegate: appDelegate)");
    expect(bodyOf(scene, CONTINUE_ACTIVITY)).toContain("continueUserActivity(userActivity, appDelegate: appDelegate)");
    expect(bodyOf(scene, OPEN_HELPER)).toMatch(
      /appDelegate\.application\(UIApplication\.shared, open: urlContext\.url, options: options\)/,
    );
    expect(bodyOf(scene, CONTINUE_HELPER)).toMatch(
      /appDelegate\.application\(\s*UIApplication\.shared, continue: userActivity, restorationHandler:/,
    );
  });

  it("never bypasses the app delegate to call RCTLinkingManager from the scene delegate", async () => {
    const scene = sceneDelegateOf(await runAppDelegate(TEMPLATE));

    expect(scene).not.toMatch(/RCTLinkingManager\./);
  });

  it("preserves the open-in-place flag, source application and annotation of a URL open", async () => {
    const helper = bodyOf(sceneDelegateOf(await runAppDelegate(TEMPLATE)), OPEN_HELPER);

    expect(helper).toContain(".openInPlace: urlContext.options.openInPlace");
    expect(helper).toContain("options[.sourceApplication] = sourceApplication");
    expect(helper).toContain("options[.annotation] = annotation");
  });

  it("reuses the running React Native root when a scene reconnects", async () => {
    const connect = bodyOf(sceneDelegateOf(await runAppDelegate(TEMPLATE)), WILL_CONNECT);
    const reuse = connect.indexOf("previousWindow?.rootViewController");
    const returnAfterReuse = connect.indexOf("return", reuse);

    expect(reuse).toBeGreaterThan(-1);
    expect(connect.match(/startReactNative/g)).toHaveLength(1);
    expect(returnAfterReuse).toBeGreaterThan(reuse);
    expect(returnAfterReuse).toBeLessThan(connect.indexOf("factory.startReactNative"));
  });

  it("is idempotent when prebuild runs again without --clean", async () => {
    const once = await runAppDelegate(TEMPLATE);

    expect(await runAppDelegate(once)).toBe(once);
  });

  it("fails loudly when the AppDelegate template no longer matches", async () => {
    await expect(runAppDelegate("class AppDelegate {}\n")).rejects.toThrow(/does not match the expected Expo template/);
  });

  it("registers the scene delegate in Info.plist", async () => {
    const plist = await runInfoPlist();

    expect(
      plist.UIApplicationSceneManifest.UISceneConfigurations.UIWindowSceneSessionRoleApplication[0]
        .UISceneDelegateClassName,
    ).toBe("$(PRODUCT_MODULE_NAME).SceneDelegate");
  });
});

const SDK_TARGET = "arm64-apple-ios17.0";
const TYPECHECK_TIMEOUT_MS = 120000;

const findIphoneSdk = () => {
  try {
    return execFileSync("xcrun", ["--sdk", "iphoneos", "--show-sdk-path"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

const IPHONE_SDK = process.platform === "darwin" ? findIphoneSdk() : null;
const describeWithSdk = IPHONE_SDK ? describe : describe.skip;

const REACT_STUB = `
@_exported import UIKit

open class RCTBridge: NSObject {
  open var bundleURL: URL? { nil }
}

open class RCTReactNativeFactory: NSObject {
  open func startReactNative(withModuleName moduleName: String, in window: UIWindow?, launchOptions: [AnyHashable: Any]?) {}
}
`;

const EXPO_STUB = `
import React
import UIKit

open class ExpoAppDelegate: UIResponder, UIApplicationDelegate {
  open func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool { true }
  open func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool { false }
  open func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool { false }
}

open class ExpoReactNativeFactoryDelegate: NSObject {}

open class ExpoReactNativeFactory: RCTReactNativeFactory {
  public init(delegate: ExpoReactNativeFactoryDelegate) {}
}
`;

const APP_STUB = `
internal import Expo

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {}
`;

describeWithSdk("generated Swift against the real iOS SDK", () => {
  const typecheck = (appDelegate) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scene-lifecycle-"));
    try {
      const write = (name, contents) => {
        const file = path.join(dir, name);
        fs.writeFileSync(file, contents);
        return file;
      };
      const common = ["-sdk", IPHONE_SDK, "-target", SDK_TARGET, "-I", dir];
      const react = write("React.swift", REACT_STUB);
      const expo = write("Expo.swift", EXPO_STUB);
      execFileSync("swiftc", [
        ...common,
        "-emit-module",
        "-module-name",
        "React",
        "-parse-as-library",
        "-emit-module-path",
        path.join(dir, "React.swiftmodule"),
        react,
      ]);
      execFileSync("swiftc", [
        ...common,
        "-emit-module",
        "-module-name",
        "Expo",
        "-parse-as-library",
        "-emit-module-path",
        path.join(dir, "Expo.swiftmodule"),
        expo,
      ]);
      execFileSync(
        "swiftc",
        [
          ...common,
          "-typecheck",
          "-parse-as-library",
          "-swift-version",
          "6",
          write("AppDelegate.swift", appDelegate),
          write("App.swift", APP_STUB),
        ],
        { stdio: "pipe" },
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };

  it(
    "typechecks the stock template, so the stub modules are not what fails",
    () => {
      expect(() => typecheck(TEMPLATE)).not.toThrow();
    },
    TYPECHECK_TIMEOUT_MS,
  );

  it(
    "typechecks the migrated AppDelegate and SceneDelegate",
    async () => {
      const migrated = await runAppDelegate(TEMPLATE);

      expect(() => typecheck(migrated)).not.toThrow();
    },
    TYPECHECK_TIMEOUT_MS,
  );
});
