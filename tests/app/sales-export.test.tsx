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
  Stack: { Screen: () => null },
}));

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    WebView: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: "sales-export-webview", ...props }),
  };
});

import SalesExportScreen from "@/app/sales-export";

describe("SalesExportScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ isLoading: false, accessToken: "test-access-token" });
  });

  it("loads the authenticated export page inside the WebView", () => {
    render(<SalesExportScreen />);

    expect(screen.getByTestId("sales-export-webview").props.source).toEqual({
      uri: "https://example.com/purchases/export?access_token=test-access-token&mobile_token=test-mobile-token",
    });
  });

  it("keeps Gumroad navigation in the WebView and opens external links outside it", () => {
    render(<SalesExportScreen />);

    const shouldStart = screen.getByTestId("sales-export-webview").props.onShouldStartLoadWithRequest as (request: {
      url: string;
      mainDocumentURL?: string;
    }) => boolean;

    expect(shouldStart({ url: "https://example.com/settings" })).toBe(true);
    expect(shouldStart({ url: "mailto:support@example.com" })).toBe(true);
    expect(
      shouldStart({
        url: "https://cdn.example.test/embed",
        mainDocumentURL:
          "https://example.com/purchases/export?access_token=test-access-token&mobile_token=test-mobile-token",
      }),
    ).toBe(true);

    expect(shouldStart({ url: "https://external.example/test" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://external.example/test");
  });
});
