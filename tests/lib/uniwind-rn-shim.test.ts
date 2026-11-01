const shim = require("uniwind/components");

const reactNative = require("react-native");

describe("uniwind react-native shim", () => {
  it("forwards react-native exports the component list does not name", () => {
    expect(shim.AssetRegistry).toBeDefined();
    expect(shim.AssetRegistry).toBe(reactNative.AssetRegistry);
  });
});
