import { ConfigContext } from "expo/config";

describe("app.config", () => {
  const mockConfigContext = { config: {} } as ConfigContext;

  beforeEach(() => {
    jest.resetModules();
  });

  it("includes NSPhotoLibraryAddUsageDescription in iOS infoPlist", () => {
    const getConfig = require("../app.config").default;
    const config = getConfig(mockConfigContext);
    expect(config.ios?.infoPlist?.NSPhotoLibraryAddUsageDescription).toBeDefined();
    expect(typeof config.ios?.infoPlist?.NSPhotoLibraryAddUsageDescription).toBe("string");
    expect(config.ios?.infoPlist?.NSPhotoLibraryAddUsageDescription.length).toBeGreaterThan(0);
  });
});
