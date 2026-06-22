import { render, screen } from "@testing-library/react-native";

const mockUseAuth = jest.fn();
const mockSafeOpenURL = jest.fn();
const mockInjectJavaScript = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/lib/open-url", () => ({
  safeOpenURL: (url: string) => mockSafeOpenURL(url),
}));

jest.mock("expo-router", () => ({
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => React.ReactNode } }) => {
      const React = require("react");
      return React.createElement(React.Fragment, null, options?.headerRight?.());
    },
  },
}));

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
}));

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    WebView: React.forwardRef(function MockWebView(props: Record<string, unknown>, ref: unknown) {
      React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInjectJavaScript, postMessage: jest.fn() }));
      return React.createElement(View, { testID: "payments-webview", ...props });
    }),
  };
});

import PayoutSettingsScreen from "@/app/settings/payments";

const expectedUrl =
  "https://example.com/settings/payments?display=mobile_app&access_token=test-access-token&mobile_token=test-mobile-token";

describe("PayoutSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ isLoading: false, accessToken: "test-access-token" });
  });

  it("loads the authenticated payouts page inside the WebView", () => {
    render(<PayoutSettingsScreen />);

    const source = screen.getByTestId("payments-webview").props.source as { uri: string };
    expect(source.uri).toContain("display=mobile_app");
    expect(source.uri).toContain("access_token=test-access-token");
    expect(source.uri).toContain("mobile_token=test-mobile-token");
    expect(source.uri).toBe(expectedUrl);
  });

  it("keeps payment-provider and Gumroad navigation in the WebView and opens unrelated links outside it", () => {
    render(<PayoutSettingsScreen />);

    const shouldStart = screen.getByTestId("payments-webview").props.onShouldStartLoadWithRequest as (request: {
      url: string;
      mainDocumentURL?: string;
    }) => boolean;

    expect(shouldStart({ url: "https://connect-js.stripe.com/v1.0/connect.js" })).toBe(true);
    expect(shouldStart({ url: "https://example.com/settings/payments" })).toBe(true);

    expect(shouldStart({ url: "https://external.example/test" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://external.example/test");
  });

  it("opens target=_blank help links externally but keeps provider popups in the WebView", () => {
    render(<PayoutSettingsScreen />);

    const onOpenWindow = screen.getByTestId("payments-webview").props.onOpenWindow as (event: {
      nativeEvent: { targetUrl: string };
    }) => void;

    onOpenWindow({ nativeEvent: { targetUrl: "https://example.com/help/article/260-your-payout-settings-page" } });
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://example.com/help/article/260-your-payout-settings-page");

    mockSafeOpenURL.mockClear();
    onOpenWindow({ nativeEvent: { targetUrl: "https://connect.stripe.com/setup/s/abc" } });
    expect(mockSafeOpenURL).not.toHaveBeenCalled();
    expect(mockInjectJavaScript).toHaveBeenCalled();
  });
});
