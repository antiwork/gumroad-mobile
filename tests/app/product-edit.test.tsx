import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../render-with-query-client";
import ProductEdit from "@/app/products/[id]";
import { Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";

const mockBack = jest.fn();
const mockPostMessage = jest.fn();
const mockSafeOpenURL = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: jest.fn(() => ({
    id: "prod-abc",
    uniquePermalink: "my-product",
    published: "false",
  })),
  Stack: {
    Screen: jest.fn(({ options }: { options?: { headerLeft?: () => unknown; headerRight?: () => unknown } }) => {
      const React = require("react");
      const { View } = require("react-native");
      const left = options?.headerLeft ? options.headerLeft() : null;
      const right = options?.headerRight ? options.headerRight() : null;
      return React.createElement(View, { testID: "screen-header" },
        left ? React.cloneElement(left as React.ReactElement, { key: "left" }) : null,
        right ? React.cloneElement(right as React.ReactElement, { key: "right" }) : null,
      );
    }),
  },
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ isLoading: false, accessToken: "test-token" }),
}));

jest.mock("@/lib/open-url", () => ({
  safeOpenURL: (...args: unknown[]) => mockSafeOpenURL(...args),
}));

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
}));

jest.mock("react-native-webview", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MockWebView = React.forwardRef(
    (props: Record<string, unknown>, ref: React.Ref<{ postMessage: jest.Mock }>) => {
      React.useImperativeHandle(ref, () => ({ postMessage: mockPostMessage }));
      return React.createElement(View, { ...props, testID: props.testID ?? "product-edit-webview" });
    },
  );
  MockWebView.displayName = "MockWebView";
  return { WebView: MockWebView };
});

beforeEach(() => {
  jest.clearAllMocks();
  (useLocalSearchParams as jest.Mock).mockReturnValue({
    id: "prod-abc",
    uniquePermalink: "my-product",
    published: "false",
  });
});

describe("ProductEdit screen (WebView)", () => {
  it("renders the WebView with the correct URL", () => {
    renderWithQueryClient(<ProductEdit />);
    const webview = screen.getByTestId("product-edit-webview");
    expect(webview.props.source.uri).toBe(
      "https://example.com/products/my-product/edit?display=mobile_app&access_token=test-token&mobile_token=test-mobile-token",
    );
  });

  it("shows error state when productId is missing", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "",
      uniquePermalink: "my-product",
      published: "false",
    });
    renderWithQueryClient(<ProductEdit />);
    expect(screen.getByText("Unable to load product editor.")).toBeTruthy();
    expect(screen.queryByTestId("product-edit-webview")).toBeNull();
  });

  it("shows error state when uniquePermalink is missing", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "prod-abc",
      uniquePermalink: "",
      published: "false",
    });
    renderWithQueryClient(<ProductEdit />);
    expect(screen.getByText("Unable to load product editor.")).toBeTruthy();
    expect(screen.queryByTestId("product-edit-webview")).toBeNull();
  });

  it("shows Publish button label for unpublished product", () => {
    renderWithQueryClient(<ProductEdit />);
    const publishButton = screen.getByTestId("toggle-publish-button");
    expect(publishButton).toBeTruthy();
  });

  it("shows Unpublish button label for published product", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "prod-abc",
      uniquePermalink: "my-product",
      published: "true",
    });
    renderWithQueryClient(<ProductEdit />);
    expect(screen.getByTestId("toggle-publish-button")).toBeTruthy();
  });

  it("renders Save button in header", () => {
    renderWithQueryClient(<ProductEdit />);
    expect(screen.getByTestId("save-button")).toBeTruthy();
  });

  it("posts mobileAppProductSave message when Save is pressed", () => {
    renderWithQueryClient(<ProductEdit />);
    fireEvent.press(screen.getByTestId("save-button"));
    expect(mockPostMessage).toHaveBeenCalledWith(
      JSON.stringify({ type: "mobileAppProductSave", payload: {} }),
    );
  });

  it("posts mobileAppProductPublish message for unpublished product", () => {
    renderWithQueryClient(<ProductEdit />);
    fireEvent.press(screen.getByTestId("toggle-publish-button"));
    expect(mockPostMessage).toHaveBeenCalledWith(
      JSON.stringify({ type: "mobileAppProductPublish", payload: {} }),
    );
  });

  it("posts mobileAppProductUnpublish message for published product", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "prod-abc",
      uniquePermalink: "my-product",
      published: "true",
    });
    renderWithQueryClient(<ProductEdit />);
    fireEvent.press(screen.getByTestId("toggle-publish-button"));
    expect(mockPostMessage).toHaveBeenCalledWith(
      JSON.stringify({ type: "mobileAppProductUnpublish", payload: {} }),
    );
  });

  it("disables buttons while saving", async () => {
    renderWithQueryClient(<ProductEdit />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("save-button"));
    });
    expect(screen.getByTestId("save-button")).toBeDisabled();
    expect(screen.getByTestId("toggle-publish-button")).toBeDisabled();
  });

  it("clears saving state on productSaveSuccess message", async () => {
    renderWithQueryClient(<ProductEdit />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("save-button"));
    });
    expect(screen.getByTestId("save-button")).toBeDisabled();

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: "productSaveSuccess", payload: {} }) },
      });
    });

    await waitFor(() => expect(screen.getByTestId("save-button")).not.toBeDisabled());
  });

  it("shows alert and clears saving on productSaveError message", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    renderWithQueryClient(<ProductEdit />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("save-button"));
    });

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: "productSaveError", payload: { message: "Something broke" } }) },
      });
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Save Failed", "Something broke");
      expect(screen.getByTestId("save-button")).not.toBeDisabled();
    });
  });

  it("clears saving state on productPublishSuccess and updates published state", async () => {
    renderWithQueryClient(<ProductEdit />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("toggle-publish-button"));
    });

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: "productPublishSuccess", payload: {} }) },
      });
    });

    await waitFor(() => expect(screen.getByTestId("toggle-publish-button")).not.toBeDisabled());
  });

  it("clears saving state on productUnpublishSuccess and updates published state", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "prod-abc",
      uniquePermalink: "my-product",
      published: "true",
    });
    renderWithQueryClient(<ProductEdit />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("toggle-publish-button"));
    });

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: "productUnpublishSuccess", payload: {} }) },
      });
    });

    await waitFor(() => expect(screen.getByTestId("toggle-publish-button")).not.toBeDisabled());
  });

  it("opens external links in system browser", () => {
    renderWithQueryClient(<ProductEdit />);

    const webview = screen.getByTestId("product-edit-webview");
    const result = webview.props.onShouldStartLoadWithRequest({
      url: "https://external-site.com/page",
      navigationType: "click",
      mainDocumentURL: "https://external-site.com/page",
    });

    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://external-site.com/page");
    expect(result).toBe(false);
  });

  it("allows internal Gumroad navigation", () => {
    renderWithQueryClient(<ProductEdit />);

    const webview = screen.getByTestId("product-edit-webview");
    const result = webview.props.onShouldStartLoadWithRequest({
      url: "https://example.com/products/my-product/edit/content",
      navigationType: "click",
      mainDocumentURL: "https://example.com/products/my-product/edit/content",
    });

    expect(result).toBe(true);
    expect(mockSafeOpenURL).not.toHaveBeenCalled();
  });

  it("allows iframe loads (url differs from mainDocumentURL)", () => {
    renderWithQueryClient(<ProductEdit />);

    const webview = screen.getByTestId("product-edit-webview");
    const result = webview.props.onShouldStartLoadWithRequest({
      url: "https://external-video.com/embed/123",
      navigationType: "iframe-load",
      mainDocumentURL: "https://example.com/products/my-product/edit",
    });

    expect(result).toBe(true);
  });

  it("includes access_token and mobile_token in WebView URL", () => {
    renderWithQueryClient(<ProductEdit />);
    const webview = screen.getByTestId("product-edit-webview");
    expect(webview.props.source.uri).toContain("access_token=test-token");
    expect(webview.props.source.uri).toContain("mobile_token=test-mobile-token");
    expect(webview.props.source.uri).toContain("display=mobile_app");
  });

  it("shows alert and clears saving on productSaveWarning message", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    renderWithQueryClient(<ProductEdit />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("save-button"));
    });

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({ type: "productSaveWarning", payload: { message: "Missing cover image" } }),
        },
      });
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Saved with warnings", "Missing cover image");
      expect(screen.getByTestId("save-button")).not.toBeDisabled();
    });
  });

  it("opens Gumroad URLs outside the edit path in the system browser", () => {
    renderWithQueryClient(<ProductEdit />);

    const webview = screen.getByTestId("product-edit-webview");
    const result = webview.props.onShouldStartLoadWithRequest({
      url: "https://example.com/dashboard",
      navigationType: "click",
      mainDocumentURL: "https://example.com/dashboard",
    });

    expect(mockSafeOpenURL).toHaveBeenCalledWith("https://example.com/dashboard");
    expect(result).toBe(false);
  });

  it("ignores unhandled productTabChange messages without error", async () => {
    renderWithQueryClient(<ProductEdit />);

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: "productTabChange", payload: { tab: "content" } }) },
      });
    });

    expect(screen.getByTestId("save-button")).not.toBeDisabled();
  });
});
