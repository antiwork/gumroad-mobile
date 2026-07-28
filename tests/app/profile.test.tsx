import { act, render, screen, waitFor } from "@testing-library/react-native";

const mockUseAuth = jest.fn();
const mockSafeOpenURL = jest.fn();
const mockInjectJavaScript = jest.fn();
const mockRefreshToken = jest.fn();
const mockLogout = jest.fn();

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
      return React.createElement(View, { testID: "profile-webview", ...props });
    }),
  };
});

import ProfileSettingsScreen from "@/app/settings/profile";

const expectedUrl =
  "https://example.com/settings/profile?display=mobile_app&access_token=test-access-token&mobile_token=test-mobile-token";

describe("ProfileSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshToken.mockResolvedValue("refreshed-access-token");
    mockLogout.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      isLoading: false,
      accessToken: "test-access-token",
      refreshToken: mockRefreshToken,
      logout: mockLogout,
    });
  });

  it("loads the authenticated profile page inside the WebView", () => {
    render(<ProfileSettingsScreen />);

    const source = screen.getByTestId("profile-webview").props.source as { uri: string };
    expect(source.uri).toContain("display=mobile_app");
    expect(source.uri).toContain("access_token=test-access-token");
    expect(source.uri).toContain("mobile_token=test-mobile-token");
    expect(source.uri).toBe(expectedUrl);

    const props = screen.getByTestId("profile-webview").props;
    expect(props.incognito).toBe(true);
    expect(props.sharedCookiesEnabled).toBeUndefined();
    expect(props.setSupportMultipleWindows).toBe(true);
    expect(props.javaScriptCanOpenWindowsAutomatically).toBe(true);
  });

  it("keeps Gumroad navigation in the WebView and opens unrelated links outside it", () => {
    render(<ProfileSettingsScreen />);

    const shouldStart = screen.getByTestId("profile-webview").props.onShouldStartLoadWithRequest as (request: {
      url: string;
      mainDocumentURL?: string;
    }) => boolean;

    expect(shouldStart({ url: "https://example.com/settings/profile" })).toBe(true);
    expect(shouldStart({ url: "about:blank" })).toBe(true);

    expect(shouldStart({ url: "https://external.example/test" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://external.example/test");
  });

  it("hands non-web scheme navigations to the OS instead of loading them in the WebView", () => {
    render(<ProfileSettingsScreen />);

    const shouldStart = screen.getByTestId("profile-webview").props.onShouldStartLoadWithRequest as (request: {
      url: string;
      mainDocumentURL?: string;
    }) => boolean;

    expect(shouldStart({ url: "mailto:support@example.com" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("mailto:support@example.com");
  });

  it("refreshes the native session when the WebView rejects its access token", async () => {
    render(<ProfileSettingsScreen />);

    const onHttpError = screen.getByTestId("profile-webview").props.onHttpError as (event: {
      nativeEvent: { statusCode: number; url: string; description: string };
    }) => void;
    act(() => {
      onHttpError({
        nativeEvent: {
          statusCode: 401,
          url: "https://example.com/profile",
          description: "The access token is invalid",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("profile-webview").props.source).toEqual({
        uri: expectedUrl.replace("test-access-token", "refreshed-access-token"),
      });
    });
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("opens target=_blank help links externally but keeps provider popups in the WebView", () => {
    render(<ProfileSettingsScreen />);

    const onOpenWindow = screen.getByTestId("profile-webview").props.onOpenWindow as (event: {
      nativeEvent: { targetUrl: string };
    }) => void;

    onOpenWindow({ nativeEvent: { targetUrl: "https://example.com/help/article/123" } });
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://example.com/help/article/123");

    mockSafeOpenURL.mockClear();
    onOpenWindow({ nativeEvent: { targetUrl: "https://connect.stripe.com/setup/s/abc" } });
    expect(mockSafeOpenURL).not.toHaveBeenCalled();
    expect(mockInjectJavaScript).toHaveBeenCalled();
  });
});
