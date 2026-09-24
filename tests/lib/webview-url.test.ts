import { buildAuthenticatedWebViewUrl, nativeScreenForWebViewUrl } from "@/lib/webview-url";

describe("nativeScreenForWebViewUrl", () => {
  it("maps the payout settings page to its native screen", () => {
    expect(nativeScreenForWebViewUrl("https://example.com/settings/payments")).toBe("/settings/payments");
    expect(nativeScreenForWebViewUrl("https://example.com/settings/payments?display=mobile_app")).toBe(
      "/settings/payments",
    );
    expect(nativeScreenForWebViewUrl("https://example.com/settings/payments/")).toBe("/settings/payments");
  });

  it("leaves every other URL for the WebView", () => {
    expect(nativeScreenForWebViewUrl("https://example.com/products/abc123/edit")).toBeNull();
    expect(nativeScreenForWebViewUrl("https://example.com/settings/profile")).toBeNull();
    expect(nativeScreenForWebViewUrl("https://example.com/settings/payments/other")).toBeNull();
    expect(nativeScreenForWebViewUrl("https://external.example/settings/payments")).toBeNull();
    expect(nativeScreenForWebViewUrl("about:blank")).toBeNull();
    expect(nativeScreenForWebViewUrl("mailto:support@example.com")).toBeNull();
  });

  it("leaves the authenticated URLs built for the WebView alone", () => {
    const url = buildAuthenticatedWebViewUrl("/products/new", "test-access-token", { display: "mobile_app" });
    expect(nativeScreenForWebViewUrl(url)).toBeNull();
  });
});
