import createConfig from "../app.config";

describe("app.config", () => {
  const config = createConfig({ config: {} } as never);

  it("declares camera and microphone usage descriptions so WebView media capture cannot crash the app", () => {
    expect(config.ios?.infoPlist?.NSCameraUsageDescription).toEqual(expect.any(String));
    expect(config.ios?.infoPlist?.NSMicrophoneUsageDescription).toEqual(expect.any(String));
  });

  it("keeps the photo library save usage description", () => {
    expect(config.ios?.infoPlist?.NSPhotoLibraryAddUsageDescription).toEqual(expect.any(String));
  });

  it("allows fullscreen video to rotate while the rest of the app starts in portrait", () => {
    expect(config.orientation).toBe("default");
    expect(config.ios?.requireFullScreen).toBeUndefined();
    expect(config.plugins).toContainEqual([
      "expo-screen-orientation",
      {
        initialOrientation: "PORTRAIT_UP",
      },
    ]);
  });
});
