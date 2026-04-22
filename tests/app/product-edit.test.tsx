import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../render-with-query-client";
import ProductEdit from "@/app/products/[id]";
import { Alert, Share } from "react-native";
import { useLocalSearchParams } from "expo-router";

const mockBack = jest.fn();
const mockPostMessage = jest.fn();
const mockReload = jest.fn();
const mockSafeOpenURL = jest.fn();
const mockHapticsNotification = jest.fn();

jest.mock("expo-haptics", () => ({
  notificationAsync: (...args: unknown[]) => {
    mockHapticsNotification(...args);
    return Promise.resolve();
  },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: jest.fn(() => ({
    id: "prod-abc",
    uniquePermalink: "my-product",
    published: "false",
  })),
  Stack: {
    Screen: jest.fn(({ options }: { options?: { title?: string; headerLeft?: () => unknown; headerRight?: () => unknown } }) => {
      const React = require("react");
      const { View, Text } = require("react-native");
      const left = options?.headerLeft ? options.headerLeft() : null;
      const right = options?.headerRight ? options.headerRight() : null;
      return React.createElement(View, { testID: "screen-header" },
        React.createElement(Text, { testID: "screen-header-title", key: "title" }, options?.title ?? ""),
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
    (props: Record<string, unknown>, ref: React.Ref<{ postMessage: jest.Mock; reload: jest.Mock }>) => {
      React.useImperativeHandle(ref, () => ({ postMessage: mockPostMessage, reload: mockReload }));
      return React.createElement(View, { ...props, testID: props.testID ?? "product-edit-webview" });
    },
  );
  MockWebView.displayName = "MockWebView";
  return { WebView: MockWebView };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
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

  it("prompts for confirmation before unpublishing and posts unpublish on confirm", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "prod-abc",
      uniquePermalink: "my-product",
      published: "true",
    });
    const alertSpy = jest.spyOn(Alert, "alert");
    renderWithQueryClient(<ProductEdit />);
    fireEvent.press(screen.getByTestId("toggle-publish-button"));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockPostMessage).not.toHaveBeenCalled();

    const lastCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    const buttons = lastCall[2] as { text: string; style?: string; onPress?: () => void }[];
    const destructive = buttons.find((b) => b.style === "destructive");
    expect(destructive?.text).toBe("Unpublish");
    act(() => {
      destructive?.onPress?.();
    });

    expect(mockPostMessage).toHaveBeenCalledWith(
      JSON.stringify({ type: "mobileAppProductUnpublish", payload: {} }),
    );
  });

  it("does not post unpublish when user cancels the confirmation dialog", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "prod-abc",
      uniquePermalink: "my-product",
      published: "true",
    });
    const alertSpy = jest.spyOn(Alert, "alert");
    renderWithQueryClient(<ProductEdit />);
    fireEvent.press(screen.getByTestId("toggle-publish-button"));

    const lastCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    const buttons = lastCall[2] as { text: string; style?: string; onPress?: () => void }[];
    const cancel = buttons.find((b) => b.style === "cancel");
    cancel?.onPress?.();

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("disables buttons while saving", async () => {
    renderWithQueryClient(<ProductEdit />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("save-button"));
    });
    expect(screen.getByTestId("save-button")).toBeDisabled();
    expect(screen.getByTestId("toggle-publish-button")).toBeDisabled();
  });

  it("shows saving overlay while a save is in-flight", async () => {
    renderWithQueryClient(<ProductEdit />);
    await act(async () => {
      fireEvent.press(screen.getByTestId("save-button"));
    });
    expect(screen.getByTestId("saving-overlay")).toBeTruthy();
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

  it("shows a success alert and triggers haptics on productSaveSuccess", async () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    renderWithQueryClient(<ProductEdit />);

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: "productSaveSuccess", payload: {} }) },
      });
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Changes saved", "Your product has been saved.");
      expect(mockHapticsNotification).toHaveBeenCalledWith("success");
    });
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
    const alertSpy = jest.spyOn(Alert, "alert");
    renderWithQueryClient(<ProductEdit />);

    fireEvent.press(screen.getByTestId("toggle-publish-button"));
    const confirmCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    const buttons = confirmCall[2] as { text: string; style?: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find((b) => b.style === "destructive")?.onPress?.();
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

  it("reflects productTabChange messages in the tab bar", async () => {
    renderWithQueryClient(<ProductEdit />);

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: "productTabChange", payload: { tab: "content" } }) },
      });
    });

    expect(screen.getByTestId("editor-tab-bar")).toBeTruthy();
    expect(screen.getByTestId("editor-tab-content")).toBeTruthy();
    expect(screen.getByTestId("save-button")).not.toBeDisabled();
  });

  it("dismisses the screen on productSaveSuccess", async () => {
    renderWithQueryClient(<ProductEdit />);

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: "productSaveSuccess", payload: {} }) },
      });
    });

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  it("dismisses the screen on productUnpublishSuccess", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "prod-abc",
      uniquePermalink: "my-product",
      published: "true",
    });
    renderWithQueryClient(<ProductEdit />);

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: "productUnpublishSuccess", payload: {} }) },
      });
    });

    await waitFor(() => expect(mockBack).toHaveBeenCalledTimes(1));
  });

  it("does not dismiss the screen on productPublishSuccess", async () => {
    renderWithQueryClient(<ProductEdit />);

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: "productPublishSuccess", payload: {} }) },
      });
    });

    expect(mockBack).not.toHaveBeenCalled();
  });

  it("does not dismiss the screen on productSaveWarning", async () => {
    renderWithQueryClient(<ProductEdit />);

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({ type: "productSaveWarning", payload: { message: "Missing cover image" } }),
        },
      });
    });

    expect(mockBack).not.toHaveBeenCalled();
  });

  it("does not dismiss the screen on productSaveError", async () => {
    renderWithQueryClient(<ProductEdit />);

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onMessage({
        nativeEvent: { data: JSON.stringify({ type: "productSaveError", payload: { message: "boom" } }) },
      });
    });

    expect(mockBack).not.toHaveBeenCalled();
  });

  it("calls webView.reload when Reload header button is pressed", () => {
    renderWithQueryClient(<ProductEdit />);
    fireEvent.press(screen.getByTestId("reload-button"));
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it("hides the Share button when product is not published", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "prod-abc",
      uniquePermalink: "my-product",
      published: "false",
      shortUrl: "https://gum.co/abc",
    });
    renderWithQueryClient(<ProductEdit />);
    expect(screen.queryByTestId("share-button")).toBeNull();
  });

  it("hides the Share button when shortUrl is missing", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "prod-abc",
      uniquePermalink: "my-product",
      published: "true",
      shortUrl: "",
    });
    renderWithQueryClient(<ProductEdit />);
    expect(screen.queryByTestId("share-button")).toBeNull();
  });

  it("shows the Share button and triggers Share.share for published product with shortUrl", async () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "prod-abc",
      uniquePermalink: "my-product",
      published: "true",
      shortUrl: "https://gum.co/abc",
      name: "My Product",
    });
    const shareSpy = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" } as never);
    renderWithQueryClient(<ProductEdit />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("share-button"));
    });

    await waitFor(() => {
      expect(shareSpy).toHaveBeenCalledWith({
        url: "https://gum.co/abc",
        message: "My Product — https://gum.co/abc",
      });
    });
  });

  it("shows the retry UI when the WebView reports an HTTP error", async () => {
    renderWithQueryClient(<ProductEdit />);
    const webview = screen.getByTestId("product-edit-webview");

    await act(async () => {
      webview.props.onHttpError({ nativeEvent: { statusCode: 500 } });
    });

    expect(screen.getByTestId("webview-error-state")).toBeTruthy();
    expect(screen.getByTestId("retry-button")).toBeTruthy();
  });

  it("shows the retry UI when the WebView reports a network error", async () => {
    renderWithQueryClient(<ProductEdit />);
    const webview = screen.getByTestId("product-edit-webview");

    await act(async () => {
      webview.props.onError({ nativeEvent: { description: "The Internet connection appears to be offline." } });
    });

    expect(screen.getByTestId("webview-error-state")).toBeTruthy();
    expect(screen.getByText("The Internet connection appears to be offline.")).toBeTruthy();
  });

  it("clears the error state and remounts the WebView when Retry is pressed", async () => {
    renderWithQueryClient(<ProductEdit />);
    const webview = screen.getByTestId("product-edit-webview");

    await act(async () => {
      webview.props.onHttpError({ nativeEvent: { statusCode: 500 } });
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId("retry-button"));
    });

    expect(screen.queryByTestId("webview-error-state")).toBeNull();
    expect(screen.getByTestId("product-edit-webview")).toBeTruthy();
  });

  it("shows the initial loading overlay until the WebView finishes its first load", async () => {
    renderWithQueryClient(<ProductEdit />);

    expect(screen.getByTestId("initial-loading-overlay")).toBeTruthy();

    const webview = screen.getByTestId("product-edit-webview");
    await act(async () => {
      webview.props.onLoadEnd();
    });

    expect(screen.queryByTestId("initial-loading-overlay")).toBeNull();
  });

  it("uses the name param as the header title when provided", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "prod-abc",
      uniquePermalink: "my-product",
      published: "false",
      name: "Cool Widget",
    });
    renderWithQueryClient(<ProductEdit />);
    expect(screen.getByTestId("screen-header-title").props.children).toBe("Cool Widget");
  });

  it("falls back to 'Edit product' when no name param is provided", () => {
    renderWithQueryClient(<ProductEdit />);
    expect(screen.getByTestId("screen-header-title").props.children).toBe("Edit product");
  });

  it("shows a Draft status badge for unpublished products", () => {
    renderWithQueryClient(<ProductEdit />);
    const badge = screen.getByTestId("status-badge");
    expect(badge).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
  });

  it("shows a Published status badge for published products", () => {
    (useLocalSearchParams as jest.Mock).mockReturnValue({
      id: "prod-abc",
      uniquePermalink: "my-product",
      published: "true",
    });
    renderWithQueryClient(<ProductEdit />);
    expect(screen.getByText("Published")).toBeTruthy();
  });
});
