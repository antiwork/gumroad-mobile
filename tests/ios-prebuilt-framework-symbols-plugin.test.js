const withIosPrebuiltFrameworkSymbols = require("../plugins/ios-prebuilt-framework-symbols");
const { keepPrebuiltFrameworkDsyms } = withIosPrebuiltFrameworkSymbols;

const PODFILE = `ENV['RCT_USE_PREBUILT_RNCORE'] ||= '1'
platform :ios, '16.4'

prepare_react_native_project!

target 'Gumroad' do
  use_react_native!
end
`;

describe("ios prebuilt framework symbols plugin", () => {
  it("asks CocoaPods for the prebuilt dSYMs before the react native project is prepared", () => {
    const result = keepPrebuiltFrameworkDsyms(PODFILE);

    expect(result).toContain("ENV['RCT_SYMBOLICATE_PREBUILT_FRAMEWORKS'] ||= '1'\nprepare_react_native_project!");
  });

  it("does not insert a second line when prebuild keeps an already patched Podfile", () => {
    const once = keepPrebuiltFrameworkDsyms(PODFILE);

    expect(keepPrebuiltFrameworkDsyms(once)).toBe(once);
  });

  it("fails loudly when the generated Podfile has no prepare_react_native_project! line", () => {
    expect(() => keepPrebuiltFrameworkDsyms("platform :ios, '16.4'\n")).toThrow(/prepare_react_native_project/);
  });

  it("patches the Podfile through the podfile mod the plugin registers", async () => {
    const config = withIosPrebuiltFrameworkSymbols({ name: "gumroad", slug: "gumroad" });
    const result = await config.mods.ios.podfile({ modRequest: {}, modResults: { contents: PODFILE } });

    expect(result.modResults.contents).toContain("# Keep prebuilt framework dSYMs for symbolication");
  });
});
