import { render, screen } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseAuth = jest.fn();
const mockSafeOpenURL = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/lib/open-url", () => ({
  safeOpenURL: (url: string) => mockSafeOpenURL(url),
}));

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockUseLocalSearchParams(),
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
});
