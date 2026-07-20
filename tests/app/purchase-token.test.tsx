import { render, screen } from "@testing-library/react-native";

const mockUseAuth = jest.fn();
const mockSafeOpenURL = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/lib/open-url", () => ({
  safeOpenURL: (url: string) => mockSafeOpenURL(url),
}));

jest.mock("expo-router", () => ({
  Stack: {
    Screen: () => null,
  },
  useLocalSearchParams: () => ({ token: "test-token", urlRedirectExternalId: "redirect-id" }),
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("expo-file-system", () => ({
  File: { downloadFileAsync: jest.fn() },
  Paths: { cache: "/cache" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock("@/components/library/use-purchases", () => ({
  usePurchase: () => undefined,
}));

jest.mock("@/components/library/use-recent-products", () => ({
  useAddRecentPurchase: () => jest.fn(),
}));

jest.mock("@/components/use-audio-player-sync", () => ({
  useAudioPlayerSync: () => ({ pauseAudio: jest.fn(), playAudio: jest.fn() }),
}));

jest.mock("@/components/mini-audio-player", () => ({
  MiniAudioPlayer: () => null,
}));

jest.mock("@/components/content-page-nav", () => ({
  ContentPageNav: () => null,
}));

jest.mock("@/components/styled", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    StyledWebView: React.forwardRef(function MockWebView(props: Record<string, unknown>, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ postMessage: jest.fn() }));
      return React.createElement(View, { testID: "purchase-webview", ...props });
    }),
  };
});

import DownloadScreen from "@/app/purchase/[token]";

const expectedUrl =
  "https://example.com/d/test-token?display=mobile_app&access_token=test-access-token&mobile_token=test-mobile-token";

const getShouldStart = () =>
  screen.getByTestId("purchase-webview").props.onShouldStartLoadWithRequest as (request: {
    url: string;
    navigationType: string;
    mainDocumentURL?: string;
  }) => boolean;

describe("DownloadScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ isLoading: false, accessToken: "test-access-token" });
  });

  it("keeps Gumroad navigation and WebView-internal schemes in the WebView", () => {
    render(<DownloadScreen />);
    const shouldStart = getShouldStart();

    expect(shouldStart({ url: expectedUrl, navigationType: "other" })).toBe(true);
    expect(shouldStart({ url: "https://example.com/library", navigationType: "click" })).toBe(true);
    expect(shouldStart({ url: "about:blank", navigationType: "other" })).toBe(true);
    expect(shouldStart({ url: "https://challenges.cloudflare.com/turnstile", navigationType: "other" })).toBe(true);
    expect(
      shouldStart({ url: "https://cdn.example.test/embed", navigationType: "other", mainDocumentURL: expectedUrl }),
    ).toBe(true);
    expect(mockSafeOpenURL).not.toHaveBeenCalled();
  });

  it("opens external web links outside the WebView", () => {
    render(<DownloadScreen />);
    const shouldStart = getShouldStart();

    expect(shouldStart({ url: "https://external.example/test", navigationType: "click" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://external.example/test");
  });

  it("hands non-web scheme navigations to the OS instead of loading them in the WebView", () => {
    render(<DownloadScreen />);
    const shouldStart = getShouldStart();

    expect(shouldStart({ url: "mailto:support@example.com", navigationType: "click" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("mailto:support@example.com");

    mockSafeOpenURL.mockClear();
    expect(shouldStart({ url: "intent://pay#Intent;scheme=upi;end", navigationType: "click" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("intent://pay#Intent;scheme=upi;end");
  });

  it("allows fullscreen video for content playing inline in the WebView", () => {
    render(<DownloadScreen />);

    expect(screen.getByTestId("purchase-webview").props.allowsFullscreenVideo).toBe(true);
  });
});
