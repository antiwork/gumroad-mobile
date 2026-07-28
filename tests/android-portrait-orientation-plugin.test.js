const { setAndroidPortraitOrientation } = require("../plugins/android-portrait-orientation");

describe("android portrait orientation plugin", () => {
  it("keeps cold launches portrait without preventing runtime overrides", () => {
    const manifest = {
      manifest: {
        application: [
          {
            $: { "android:name": ".MainApplication" },
            activity: [
              {
                $: {
                  "android:name": ".MainActivity",
                  "android:screenOrientation": "unspecified",
                },
              },
            ],
          },
        ],
      },
    };

    expect(
      setAndroidPortraitOrientation(manifest).manifest.application[0].activity[0].$["android:screenOrientation"],
    ).toBe("portrait");
  });
});
