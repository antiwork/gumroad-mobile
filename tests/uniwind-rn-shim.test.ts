const shim = jest.requireActual("uniwind/components");

const reactNative = jest.requireActual("react-native");

describe("uniwind react-native shim", () => {
  it("forwards react-native exports the component list does not name", () => {
    expect(shim.AssetRegistry).toBeDefined();
    expect(shim.AssetRegistry).toBe(reactNative.AssetRegistry);
  });

  it("keeps uniwind's styled components in place of react-native's", () => {
    expect(shim.View).toBeDefined();
    expect(shim.View).not.toBe(reactNative.View);
  });
});
