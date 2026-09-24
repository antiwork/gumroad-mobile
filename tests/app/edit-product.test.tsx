import { render, screen, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseAuth = jest.fn();
const mockSafeOpenURL = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockPush = jest.fn();
const mockFocusCallbacks: (() => void)[] = [];
const mockWebViewMounts = { count: 0 };

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/lib/open-url", () => ({
  safeOpenURL: (url: string) => mockSafeOpenURL(url),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: () => void) => {
    mockFocusCallbacks.push(callback);
  },
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
      React.useEffect(() => {
        mockWebViewMounts.count += 1;
      }, []);
      return React.createElement(View, { testID: "edit-product-webview", ...props });
    }),
  };
});

import EditProductScreen from "@/app/edit-product";

const renderScreen = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <EditProductScreen />
    </QueryClientProvider>,
  );

describe("EditProductScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusCallbacks.length = 0;
    mockWebViewMounts.count = 0;
    mockUseLocalSearchParams.mockReturnValue({ permalink: "abc123" });
    mockUseAuth.mockReturnValue({
      isLoading: false,
      accessToken: "test-access-token",
      refreshToken: jest.fn(),
      logout: jest.fn(),
    });
  });

  it("loads the authenticated product editor inside the WebView", () => {
    renderScreen();

    const source = screen.getByTestId("edit-product-webview").props.source as { uri: string };
    expect(source.uri).toContain("/products/abc123/edit");
    expect(source.uri).toContain("display=mobile_app");
    expect(source.uri).toContain("access_token=test-access-token");
  });

  it("keeps Gumroad navigation in the WebView and opens unrelated links outside it", () => {
    renderScreen();

    const shouldStart = screen.getByTestId("edit-product-webview").props.onShouldStartLoadWithRequest as (request: {
      url: string;
    }) => boolean;

    expect(shouldStart({ url: "https://example.com/products/abc123/edit" })).toBe(true);
    expect(shouldStart({ url: "about:blank" })).toBe(true);
    expect(shouldStart({ url: "https://external.example/test" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://external.example/test");
  });

  it("opens payout settings natively instead of loading the headerless page in the WebView", () => {
    renderScreen();

    const shouldStart = screen.getByTestId("edit-product-webview").props.onShouldStartLoadWithRequest as (request: {
      url: string;
    }) => boolean;

    expect(shouldStart({ url: "https://example.com/settings/payments?display=mobile_app" })).toBe(false);
    expect(mockPush).toHaveBeenCalledWith("/settings/payments");
    expect(mockSafeOpenURL).not.toHaveBeenCalled();
  });

  it("reloads the editor when the seller comes back from the native Payouts screen", () => {
    renderScreen();

    const shouldStart = screen.getByTestId("edit-product-webview").props.onShouldStartLoadWithRequest as (request: {
      url: string;
    }) => boolean;

    shouldStart({ url: "https://example.com/settings/payments" });
    act(() => {
      mockFocusCallbacks.forEach((callback) => callback());
    });

    expect(mockWebViewMounts.count).toBe(2);
  });

  it("keeps the editor as it is when it regains focus without a settings trip", () => {
    renderScreen();

    act(() => {
      mockFocusCallbacks.forEach((callback) => callback());
    });
    act(() => {
      mockFocusCallbacks.forEach((callback) => callback());
    });

    expect(mockWebViewMounts.count).toBe(1);
  });

  it("keeps the product editor and other Gumroad pages in the WebView", () => {
    renderScreen();

    const shouldStart = screen.getByTestId("edit-product-webview").props.onShouldStartLoadWithRequest as (request: {
      url: string;
    }) => boolean;

    expect(shouldStart({ url: "https://example.com/products/abc123/edit?display=mobile_app" })).toBe(true);
    expect(shouldStart({ url: "https://example.com/products/abc123" })).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  });
});
