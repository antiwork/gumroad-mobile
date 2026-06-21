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
    WebView: (props: Record<string, unknown>) => React.createElement(View, { testID: "profile-webview", ...props }),
  };
});

import ProfileSettingsScreen from "@/app/settings/profile";

const expectedUrl =
  "https://example.com/settings/profile?display=mobile_app&access_token=test-access-token&mobile_token=test-mobile-token";

describe("ProfileSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ isLoading: false, accessToken: "test-access-token" });
  });

  it("loads the authenticated profile page inside the WebView", () => {
    render(<ProfileSettingsScreen />);

    const source = screen.getByTestId("profile-webview").props.source as { uri: string };
    expect(source.uri).toContain("display=mobile_app");
    expect(source.uri).toContain("access_token=test-access-token");
    expect(source.uri).toContain("mobile_token=test-mobile-token");
    expect(source.uri).toBe(expectedUrl);
  });

  it("keeps Gumroad navigation in the WebView and opens unrelated links outside it", () => {
    render(<ProfileSettingsScreen />);

    const shouldStart = screen.getByTestId("profile-webview").props.onShouldStartLoadWithRequest as (request: {
      url: string;
      mainDocumentURL?: string;
    }) => boolean;

    expect(shouldStart({ url: "https://example.com/settings/profile" })).toBe(true);

    expect(shouldStart({ url: "https://external.example/test" })).toBe(false);
    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://external.example/test");
  });
});
