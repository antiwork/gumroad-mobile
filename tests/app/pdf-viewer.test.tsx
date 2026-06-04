import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderWithQueryClient } from "../render-with-query-client";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ uri: "https://example.com/test.pdf", title: "Test PDF" }),
  Stack: {
    Screen: ({ options }: { options?: { headerRight?: () => React.ReactNode } }) => {
      const React = require("react");
      return React.createElement(React.Fragment, null, options?.headerRight?.());
    },
  },
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => ({
  File: { downloadFileAsync: jest.fn().mockResolvedValue({ uri: "file:///cache/test.pdf" }) },
  Paths: { cache: "/cache" },
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ accessToken: "test-token" }),
}));

jest.mock("@/lib/media-location", () => ({
  updateMediaLocation: jest.fn(),
}));

jest.mock("@/modules/pdf-thumbnail", () => ({
  generateThumbnail: jest.fn().mockResolvedValue({ uri: "file:///thumb.jpg", width: 300, height: 420 }),
}));

jest.mock("@/components/pdf-navigation-sheet", () => ({
  PdfNavigationSheet: () => null,
}));

let mockOnError: ((e: unknown) => void) | null = null;

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

const deferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
};

jest.mock("react-native-pdf", () => {
  const { forwardRef } = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: forwardRef((props: Record<string, unknown>, _ref: unknown) => {
      mockOnError = props.onError as any;
      return <View testID="pdf-component" />;
    }),
  };
});

import PdfViewerScreen from "@/app/pdf-viewer";
import { act } from "react";

const renderWithProviders = () => renderWithQueryClient(<PdfViewerScreen />);

describe("PdfViewerScreen", () => {
  beforeEach(() => {
    const { File } = require("expo-file-system");
    const Sharing = require("expo-sharing");
    mockOnError = null;
    File.downloadFileAsync.mockReset();
    File.downloadFileAsync.mockResolvedValue({ uri: "file:///cache/test.pdf" });
    Sharing.isAvailableAsync.mockReset();
    Sharing.shareAsync.mockReset();
    Sharing.isAvailableAsync.mockResolvedValue(true);
  });

  it("shows error view with Try Again button when PDF fails to load", async () => {
    renderWithProviders();

    await waitFor(() => expect(screen.getByTestId("pdf-component")).toBeTruthy());
    expect(screen.queryByText("Try Again")).toBeNull();

    act(() => {
      mockOnError!(new Error("open failed: ENOENT (No such file or directory)"));
    });

    expect(screen.getByText("Try Again")).toBeTruthy();
    expect(screen.getByText(/Unable to load this PDF/)).toBeTruthy();
    expect(screen.queryByTestId("pdf-component")).toBeNull();
  });

  it("re-mounts PDF component when Try Again is pressed", async () => {
    renderWithProviders();

    await waitFor(() => expect(screen.getByTestId("pdf-component")).toBeTruthy());

    act(() => {
      mockOnError!(new Error("ENOENT"));
    });

    fireEvent.press(screen.getByText("Try Again"));

    await waitFor(() => expect(screen.getByTestId("pdf-component")).toBeTruthy());
    expect(screen.queryByText("Try Again")).toBeNull();
  });

  it("shows loading spinner while downloading PDF", () => {
    const { File } = require("expo-file-system");
    File.downloadFileAsync.mockReturnValueOnce(new Promise(() => {}));

    renderWithProviders();

    expect(screen.getByTestId("loading-spinner")).toBeTruthy();
    expect(screen.queryByTestId("pdf-component")).toBeNull();
  });

  it("shows error view when PDF download fails", async () => {
    const { File } = require("expo-file-system");
    File.downloadFileAsync.mockRejectedValueOnce(new Error("Network error"));

    renderWithProviders();

    await waitFor(() => expect(screen.getByText("Try Again")).toBeTruthy());
    expect(screen.getByText(/Unable to load this PDF/)).toBeTruthy();
    expect(screen.queryByTestId("pdf-component")).toBeNull();
  });

  it("ignores stale retry failures after a newer retry succeeds", async () => {
    const { File } = require("expo-file-system");
    const slowFailure = deferred<{ uri: string }>();
    const fastSuccess = deferred<{ uri: string }>();
    File.downloadFileAsync
      .mockRejectedValueOnce(new Error("Initial network error"))
      .mockReturnValueOnce(slowFailure.promise)
      .mockReturnValueOnce(fastSuccess.promise);

    renderWithProviders();

    await waitFor(() => expect(screen.getByText("Try Again")).toBeTruthy());
    const retryButton = screen.getByText("Try Again");

    act(() => {
      fireEvent.press(retryButton);
      fireEvent.press(retryButton);
    });

    expect(File.downloadFileAsync).toHaveBeenCalledTimes(3);

    await act(async () => {
      fastSuccess.resolve({ uri: "file:///cache/fast.pdf" });
    });

    await waitFor(() => expect(screen.getByTestId("pdf-component")).toBeTruthy());

    await act(async () => {
      slowFailure.reject(new Error("Stale retry failure"));
    });

    expect(screen.queryByText(/Unable to load this PDF/)).toBeNull();
    expect(screen.getByTestId("pdf-component")).toBeTruthy();
  });

  it("shares the cached PDF file when available", async () => {
    const { File } = require("expo-file-system");
    const Sharing = require("expo-sharing");

    renderWithProviders();

    await waitFor(() => expect(screen.getByTestId("pdf-component")).toBeTruthy());

    fireEvent.press(screen.getByTestId("share-pdf-button"));

    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith("file:///cache/test.pdf"));
    expect(File.downloadFileAsync).toHaveBeenCalledTimes(1);
  });
});
