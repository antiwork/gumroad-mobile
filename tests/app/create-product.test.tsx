import { render, screen } from "@testing-library/react-native";

const mockUseAuth = jest.fn();
const mockSafeOpenURL = jest.fn();
const mockRefreshToken = jest.fn();
const mockRefreshCreatorStatus = jest.fn();
const mockLogout = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/lib/open-url", () => ({
  safeOpenURL: (url: string) => mockSafeOpenURL(url),
}));

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
}));

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    WebView: React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      React.useImperativeHandle(ref, () => ({ injectJavaScript: jest.fn(), postMessage: jest.fn() }));
      return React.createElement(View, { testID: "create-product-webview", ...props });
    }),
  };
});

import CreateProductScreen from "@/app/create-product";

const expectedUrl =
  "https://example.com/products/new?display=mobile_app&access_token=test-access-token&mobile_token=test-mobile-token";

describe("CreateProductScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshToken.mockResolvedValue("refreshed-access-token");
    mockRefreshCreatorStatus.mockResolvedValue(undefined);
    mockLogout.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      isLoading: false,
      accessToken: "test-access-token",
      refreshToken: mockRefreshToken,
      refreshCreatorStatus: mockRefreshCreatorStatus,
      logout: mockLogout,
    });
  });

  it("loads the authenticated create-product page inside the WebView", () => {
    render(<CreateProductScreen />);

    const source = screen.getByTestId("create-product-webview").props.source as { uri: string };
    expect(source.uri).toBe(expectedUrl);

    const props = screen.getByTestId("create-product-webview").props;
    expect(props.incognito).toBe(true);
    expect(props.setSupportMultipleWindows).toBe(true);
    expect(props.javaScriptCanOpenWindowsAutomatically).toBe(true);
  });

  it("keeps Gumroad navigation in the WebView and opens unrelated links outside it", () => {
    render(<CreateProductScreen />);

    const shouldStart = screen.getByTestId("create-product-webview").props.onShouldStartLoadWithRequest as (request: {
      url: string;
      mainDocumentURL?: string;
    }) => boolean;

    expect(shouldStart({ url: "https://example.com/products/new" })).toBe(true);
    expect(shouldStart({ url: "https://example.com/products/abc123/edit" })).toBe(true);
    expect(shouldStart({ url: "about:blank" })).toBe(true);

    expect(shouldStart({ url: "https://external.example/test" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://external.example/test");
  });

  it("hands non-web scheme navigations to the OS instead of loading them in the WebView", () => {
    render(<CreateProductScreen />);

    const shouldStart = screen.getByTestId("create-product-webview").props.onShouldStartLoadWithRequest as (request: {
      url: string;
      mainDocumentURL?: string;
    }) => boolean;

    expect(shouldStart({ url: "mailto:support@example.com" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("mailto:support@example.com");
  });

  it("refreshes creator status on unmount only after the WebView reached the product editor", () => {
    const { unmount } = render(<CreateProductScreen />);

    const onNavigationStateChange = screen.getByTestId("create-product-webview").props
      .onNavigationStateChange as (navState: { url: string }) => void;
    onNavigationStateChange({ url: "https://example.com/products/abc123/edit" });

    unmount();
    expect(mockRefreshCreatorStatus).toHaveBeenCalledTimes(1);
  });

  it("does not refresh creator status when no product was created", () => {
    const { unmount } = render(<CreateProductScreen />);

    unmount();
    expect(mockRefreshCreatorStatus).not.toHaveBeenCalled();
  });
});
