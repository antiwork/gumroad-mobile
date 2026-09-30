const { raisePodDeploymentTargets } = require("../plugins/ios-pod-deployment-target");

const PODFILE = `platform :ios, '15.1'

target 'gumroad' do
  use_expo_modules!
  use_frameworks! :linkage => :static

  post_install do |installer|
    react_native_post_install(installer)
  end
end
`;

describe("ios pod deployment target plugin", () => {
  it("raises pod deployment targets from inside the post_install hook", () => {
    const result = raisePodDeploymentTargets(PODFILE);

    expect(result).toContain("  post_install do |installer|\n    # Raise pod deployment targets for Xcode 27+\n");
    expect(result).toContain("build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'");
  });

  it("does not insert a second hook when prebuild keeps an already patched Podfile", () => {
    const once = raisePodDeploymentTargets(PODFILE);

    expect(raisePodDeploymentTargets(once)).toBe(once);
  });

  it("fails loudly when the generated Podfile has no post_install hook", () => {
    expect(() => raisePodDeploymentTargets("platform :ios, '15.1'\n")).toThrow(/post_install/);
  });
});
