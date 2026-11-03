import {
  buildAuthenticatedWebViewUrl,
  isWebBuildContentPageUrl,
  isWebBuildPlayerUrl,
  nativeScreenForWebViewUrl,
} from "@/lib/webview-url";

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

describe("isWebBuildPlayerUrl", () => {
  it("recognizes a purchase's player page however it is linked", () => {
    expect(isWebBuildPlayerUrl("https://example.com/d/token-1/play", "token-1")).toBe(true);
    expect(isWebBuildPlayerUrl("https://example.com/d/token-1/play/", "token-1")).toBe(true);
    expect(isWebBuildPlayerUrl("https://example.com/d/token-1/play?display=mobile_app", "token-1")).toBe(true);
  });

  it("leaves the content page, the frame inside it and other hosts alone", () => {
    expect(isWebBuildPlayerUrl("https://example.com/d/token-1", "token-1")).toBe(false);
    expect(isWebBuildPlayerUrl("https://example.com/d/token-1/play/grant/", "token-1")).toBe(false);
    expect(isWebBuildPlayerUrl("https://example.com/d/token-2/play", "token-1")).toBe(false);
    expect(isWebBuildPlayerUrl("https://external.example/d/token-1/play", "token-1")).toBe(false);
    expect(isWebBuildPlayerUrl("about:blank", "token-1")).toBe(false);
  });
});

describe("isWebBuildContentPageUrl", () => {
  it("recognizes the page the player's own back link points at", () => {
    expect(isWebBuildContentPageUrl("https://example.com/d/token-1", "token-1")).toBe(true);
    expect(isWebBuildContentPageUrl("https://example.com/d/token-1/?display=mobile_app", "token-1")).toBe(true);
  });

  it("does not claim the player page or another purchase", () => {
    expect(isWebBuildContentPageUrl("https://example.com/d/token-1/play", "token-1")).toBe(false);
    expect(isWebBuildContentPageUrl("https://example.com/d/token-2", "token-1")).toBe(false);
    expect(isWebBuildContentPageUrl("https://external.example/d/token-1", "token-1")).toBe(false);
  });
});
