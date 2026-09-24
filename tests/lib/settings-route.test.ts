import { getNativeSettingsRoute } from "@/lib/settings-route";

describe("getNativeSettingsRoute", () => {
  it("maps the settings pages that have a native screen", () => {
    expect(getNativeSettingsRoute("https://example.com/settings/payments")).toBe("/settings/payments");
    expect(getNativeSettingsRoute("https://example.com/settings/payments?display=mobile_app")).toBe("/settings/payments");
    expect(getNativeSettingsRoute("https://example.com/settings/profile")).toBe("/settings/profile");
  });

  it("ignores settings pages without a native screen", () => {
    expect(getNativeSettingsRoute("https://example.com/settings/password")).toBeNull();
    expect(getNativeSettingsRoute("https://example.com/products/abc123/edit")).toBeNull();
  });

  it("ignores settings URLs on another origin", () => {
    expect(getNativeSettingsRoute("https://external.example/settings/payments")).toBeNull();
  });

  it("ignores URLs it cannot parse", () => {
    expect(getNativeSettingsRoute("about:blank")).toBeNull();
    expect(getNativeSettingsRoute("not a url")).toBeNull();
  });
});