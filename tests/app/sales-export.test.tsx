import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { Alert as NativeAlert } from "react-native";

const mockUseAuth = jest.fn();
const mockSafeOpenURL = jest.fn();
const mockDownloadFileAsync = jest.fn();
const mockIsSharingAvailableAsync = jest.fn();
const mockShareAsync = jest.fn();
const mockCaptureException = jest.fn();

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

jest.mock("expo-file-system", () => ({
  File: { downloadFileAsync: (...args: unknown[]) => mockDownloadFileAsync(...args) },
  Paths: { cache: "/cache" },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: () => mockIsSharingAvailableAsync(),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock("@sentry/react-native", () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
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
    mockDownloadFileAsync.mockResolvedValue({ uri: "file:///cache/sales.csv" });
    mockIsSharingAvailableAsync.mockResolvedValue(true);
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

  it("downloads the sales export and opens the native share sheet", async () => {
    render(<SalesExportScreen />);

    fireEvent.press(screen.getByText("Download CSV"));

    await waitFor(() => {
      expect(mockShareAsync).toHaveBeenCalledWith("file:///cache/sales.csv", {
        UTI: "public.comma-separated-values-text",
        mimeType: "text/csv",
        dialogTitle: "Export all sales",
      });
    });
    expect(mockDownloadFileAsync).toHaveBeenCalledWith(
      "https://example.com/purchases/export?access_token=test-access-token&mobile_token=test-mobile-token",
      "/cache",
      { idempotent: true },
    );
  });

  it("reports download failures", async () => {
    jest.spyOn(NativeAlert, "alert");
    mockIsSharingAvailableAsync.mockResolvedValueOnce(false);

    render(<SalesExportScreen />);

    fireEvent.press(screen.getByText("Download CSV"));

    await waitFor(() => {
      expect(NativeAlert.alert).toHaveBeenCalledWith(
        "Download failed",
        "Sharing is not available on this device",
      );
    });
    expect(mockCaptureException).toHaveBeenCalledWith(expect.any(Error));
  });
});
