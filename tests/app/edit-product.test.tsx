import { act, render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseAuth = jest.fn();
const mockSafeOpenURL = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockPush = jest.fn();
const mockWebViewMounts = { count: 0 };
let mockFocusCallback: (() => void) | undefined;

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
    const React = require("react");
    mockFocusCallback = callback;
    React.useEffect(callback, [callback]);
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

const shouldStartLoad = () =>
  screen.getByTestId("edit-product-webview").props.onShouldStartLoadWithRequest as (request: {
    url: string;
    mainDocumentURL?: string;
  }) => boolean;

describe("EditProductScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWebViewMounts.count = 0;
    mockFocusCallback = undefined;
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

    const shouldStart = shouldStartLoad();

    expect(shouldStart({ url: "https://example.com/products/abc123/edit" })).toBe(true);
    expect(shouldStart({ url: "about:blank" })).toBe(true);
    expect(shouldStart({ url: "https://external.example/test" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://external.example/test");
  });

  it("opens the payout settings link on the native Payouts screen instead of the editor WebView", () => {
    renderScreen();

    expect(shouldStartLoad()({ url: "https://example.com/settings/payments" })).toBe(false);
    expect(mockPush).toHaveBeenCalledWith("/settings/payments");
    expect(mockSafeOpenURL).not.toHaveBeenCalled();
  });

  it("opens the profile settings link on the native settings screen", () => {
    renderScreen();

    expect(shouldStartLoad()({ url: "https://example.com/settings/profile" })).toBe(false);
    expect(mockPush).toHaveBeenCalledWith("/settings/profile");
  });

  it("reloads the editor when the seller returns from the Payouts screen", () => {
    renderScreen();
    expect(mockWebViewMounts.count).toBe(1);

    shouldStartLoad()({ url: "https://example.com/settings/payments" });
    act(() => {
      mockFocusCallback?.();
    });

    expect(mockWebViewMounts.count).toBe(2);
  });

  it("keeps the editor mounted when it regains focus without a settings trip", () => {
    renderScreen();

    act(() => {
      mockFocusCallback?.();
    });
    act(() => {
      mockFocusCallback?.();
    });

    expect(mockWebViewMounts.count).toBe(1);
  });
});